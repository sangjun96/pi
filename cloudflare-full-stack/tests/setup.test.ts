import { mkdtemp, mkdir, readFile, rm, copyFile, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, delimiter } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "template-setup-")); temporary.push(root);
  await mkdir(join(root, "scripts")); await mkdir(join(root, "bin"));
  await copyFile(resolve("scripts/setup.ts"), join(root, "scripts/setup.ts"));
  await copyFile(resolve(".dev.vars.example"), join(root, ".dev.vars.example"));
  const pnpm = join(root, "bin/pnpm");
  await writeFile(pnpm, "#!/bin/sh\necho \"$*\" >> \"$SETUP_TEST_LOG\"\nexit 0\n"); await chmod(pnpm, 0o755);
  return root;
}
function run(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [join(root, "scripts/setup.ts"), ...args], { encoding: "utf8", env: { ...process.env, PATH: `${join(root, "bin")}${delimiter}${process.env.PATH}`, SETUP_TEST_LOG: join(root, "commands.log") } });
}
describe("local setup", () => {
  it("creates a secret, runs local commands, and preserves the existing file on rerun", async () => {
    const root = await fixture();
    const first = run(root); expect(first.status).toBe(0);
    const vars = await readFile(join(root, ".dev.vars"), "utf8");
    expect(vars).toMatch(/BETTER_AUTH_SECRET=[a-f0-9]{64}/);
    expect(first.stdout).not.toContain(vars.match(/[a-f0-9]{64}/)?.[0]);
    expect(await readFile(join(root, "commands.log"), "utf8")).toBe("install --frozen-lockfile\ndb:migrate:local\n");
    const second = run(root, "--skip-install", "--skip-migrate");
    expect(second.status).toBe(0); expect(second.stdout).toContain("Preserved existing .dev.vars");
    expect(await readFile(join(root, ".dev.vars"), "utf8")).toBe(vars);
  });
  it("dry run performs no writes or commands", async () => {
    const root = await fixture(); const result = run(root, "--dry-run");
    expect(result.status).toBe(0); expect(result.stdout).toContain("no files or databases changed");
    await expect(readFile(join(root, ".dev.vars"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(root, "commands.log"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
