import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const allowed = new Set(["--help", "--dry-run", "--skip-install", "--skip-migrate"]);
for (const arg of args) if (!allowed.has(arg)) throw new Error(`Unknown option: ${arg}`);
if (args.has("--help")) {
  console.log(`Set up the template locally.\n\nUsage: pnpm run setup [--dry-run] [--skip-install] [--skip-migrate]\n\nCreates .dev.vars only when missing, installs locked dependencies, and applies local D1 migrations. Never provisions remote resources or creates accounts. Existing secrets and local data are preserved.`);
} else {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 18)) throw new Error("Node.js 22.18 or newer is required");
  const dryRun = args.has("--dry-run");
  const varsPath = resolve(root, ".dev.vars");
  const example = await readFile(resolve(root, ".dev.vars.example"), "utf8");
  const placeholder = "replace-with-at-least-32-random-characters";
  if (!example.includes(placeholder)) throw new Error(".dev.vars.example is missing its secret placeholder");
  if (dryRun) {
    console.log("Would create .dev.vars only if missing, with a new random local auth secret.");
  } else {
    try {
      const contents = example.replace(placeholder, randomBytes(32).toString("hex"));
      await writeFile(varsPath, contents, { flag: constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, mode: 0o600 });
      console.log("Created .dev.vars with a new local auth secret; AI keys are blank.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      console.log("Preserved existing .dev.vars.");
    }
  }
  function run(label: string, commandArgs: string[]) {
    console.log(`${dryRun ? "Would run" : "Running"}: ${label}`);
    if (dryRun) return;
    const result = spawnSync("pnpm", commandArgs, { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${label} failed (exit ${result.status ?? "unknown"})`);
  }
  if (!args.has("--skip-install")) run("pnpm install --frozen-lockfile", ["install", "--frozen-lockfile"]);
  if (!args.has("--skip-migrate")) run("pnpm db:migrate:local", ["db:migrate:local"]);
  if (dryRun) console.log("Dry run complete; no files or databases changed.");
  else if (args.has("--skip-install") || args.has("--skip-migrate")) console.log("Setup finished with steps skipped; complete them before starting. No remote resources were changed.");
  else console.log("Local setup complete. Create a local account interactively with pnpm account:create:local, then start with pnpm dev. No remote resources were changed.");
}
