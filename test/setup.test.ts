import { mkdtemp, mkdir, readFile, rm, copyFile, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, delimiter } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, expect, test } from "vitest";

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pi-package-setup-")); temporary.push(root);
  await mkdir(join(root, "scripts")); await mkdir(join(root, "bin"));
  await copyFile(resolve("scripts/setup.ts"), join(root, "scripts/setup.ts"));
  await writeFile(join(root, "package.json"), '{\n  "name": "my-pi-package",\n  "version": "0.1.0"\n}\n');
  const pnpm = join(root, "bin/pnpm");
  await writeFile(pnpm, '#!/bin/sh\necho "$*" >> "$TEST_LOG"\nexit "${TEST_EXIT:-0}"\n'); await chmod(pnpm, 0o755);
  return root;
}
function run(root: string, args: string[] = [], extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, [join(root, "scripts/setup.ts"), ...args], { encoding: "utf8", env: { ...process.env, PATH: `${join(root, "bin")}${delimiter}${process.env.PATH}`, TEST_LOG: join(root, "commands.log"), ...extraEnv } });
}
test("sets up without renaming unless requested", async () => {
  const root = await fixture(); const original = await readFile(join(root, "package.json"), "utf8");
  const result = run(root); expect(result.status).toBe(0);
  expect(await readFile(join(root, "package.json"), "utf8")).toBe(original);
  expect(await readFile(join(root, "commands.log"), "utf8")).toBe("install --frozen-lockfile\ntest\n");
});
test("supports scoped names and preserves formatting", async () => {
  const root = await fixture(); const result = run(root, ["--name", "@team/my-package", "--skip-install", "--skip-tests"]);
  expect(result.status).toBe(0);
  expect(await readFile(join(root, "package.json"), "utf8")).toBe('{\n  "name": "@team/my-package",\n  "version": "0.1.0"\n}\n');
});
test("dry run and invalid names do not change files or run commands", async () => {
  const root = await fixture(); const original = await readFile(join(root, "package.json"), "utf8");
  expect(run(root, ["--dry-run", "--name", "other-name"]).status).toBe(0);
  expect(run(root, ["--name", "../invalid"]).status).not.toBe(0);
  expect(await readFile(join(root, "package.json"), "utf8")).toBe(original);
  await expect(readFile(join(root, "commands.log"))).rejects.toMatchObject({ code: "ENOENT" });
});
test("stops when installation fails", async () => {
  const root = await fixture(); const result = run(root, [], { TEST_EXIT: "1" });
  expect(result.status).not.toBe(0);
  expect(await readFile(join(root, "commands.log"), "utf8")).toBe("install --frozen-lockfile\n");
});
