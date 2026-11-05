import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import setupPackage from "../extensions/setup-package.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "pi-setup-command-")); dirs.push(cwd);
  let handler!: (args: string, ctx: any) => Promise<void>;
  const exec = vi.fn();
  setupPackage({ registerCommand: (_name: string, command: any) => { handler = command.handler; }, exec } as unknown as ExtensionAPI);
  const ui = { confirm: vi.fn().mockResolvedValue(true), notify: vi.fn() };
  return { cwd, handler, exec, ui, ctx: { cwd, hasUI: true, ui } };
}
test("creates the Cloudflare template in another directory", async () => {
  const f = await fixture(); await mkdir(join(f.cwd, ".git")); await f.handler("", f.ctx);
  expect(JSON.parse(await readFile(join(f.cwd, "package.json"), "utf8")).scripts.setup).toBe("node scripts/setup.ts");
  expect(await readFile(join(f.cwd, ".dev.vars.example"), "utf8")).toContain("replace-with");
  expect(f.exec).not.toHaveBeenCalled();
  expect(f.ui.notify).toHaveBeenLastCalledWith(expect.stringContaining("Cloudflare project created"), "info");
});
test("preserves existing files and stops before copying on conflict", async () => {
  const f = await fixture(); await writeFile(join(f.cwd, "package.json"), "original"); await f.handler("", f.ctx);
  expect(await readFile(join(f.cwd, "package.json"), "utf8")).toBe("original");
  await expect(readFile(join(f.cwd, "index.html"))).rejects.toThrow();
  expect(f.ui.confirm).not.toHaveBeenCalled();
});
test("cancellation and arguments do not copy files", async () => {
  const f = await fixture(); f.ui.confirm.mockResolvedValueOnce(false); await f.handler("", f.ctx); await f.handler("unexpected", f.ctx);
  await expect(readFile(join(f.cwd, "package.json"))).rejects.toThrow();
});
