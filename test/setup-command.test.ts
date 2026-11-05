import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import setupPackage from "../extensions/setup-package.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "pi-setup-command-")); dirs.push(cwd);
  await mkdir(join(cwd, "scripts"));
  await writeFile(join(cwd, "scripts/setup.ts"), "");
  await writeFile(join(cwd, "package.json"), JSON.stringify({ name: "original", scripts: { setup: "node scripts/setup.ts" } }));
  let handler!: (args: string, ctx: any) => Promise<void>;
  const exec = vi.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "", killed: false, truncated: false });
  setupPackage({ registerCommand: (_name: string, command: any) => { handler = command.handler; }, exec } as unknown as ExtensionAPI);
  const ui = { input: vi.fn().mockResolvedValue("@team/project"), confirm: vi.fn().mockResolvedValue(true), notify: vi.fn() };
  return { cwd, handler, exec, ui, ctx: { cwd, hasUI: true, ui } };
}
test("runs setup with the entered name after confirmation", async () => {
  const f = await fixture(); await f.handler("", f.ctx);
  expect(f.exec).toHaveBeenCalledWith("pnpm", ["run", "setup", "--name", "@team/project"], { cwd: f.cwd });
  expect(f.ui.notify).toHaveBeenLastCalledWith(expect.stringContaining("tests passed"), "info");
});
test("blank input preserves name; cancellation and invalid names do not run", async () => {
  const f = await fixture(); f.ui.input.mockResolvedValueOnce(""); await f.handler("", f.ctx);
  expect(f.exec).toHaveBeenCalledWith("pnpm", ["run", "setup"], { cwd: f.cwd });
  f.exec.mockClear(); f.ui.input.mockResolvedValueOnce("../bad"); await f.handler("", f.ctx);
  f.ui.input.mockResolvedValueOnce(undefined); await f.handler("", f.ctx);
  f.ui.confirm.mockResolvedValueOnce(false); await f.handler("", f.ctx);
  expect(f.exec).not.toHaveBeenCalled();
});
test("reports process failure and rejects a missing checkout", async () => {
  const f = await fixture(); f.exec.mockResolvedValueOnce({ code: 1, stderr: "test failed", stdout: "", killed: false, truncated: false });
  await f.handler("", f.ctx); expect(f.ui.notify).toHaveBeenLastCalledWith(expect.stringContaining("test failed"), "error");
  f.exec.mockClear(); await f.handler("", { ...f.ctx, cwd: join(f.cwd, "missing") }); expect(f.exec).not.toHaveBeenCalled();
});
