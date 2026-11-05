import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let name: string | undefined;
let dryRun = false;
let skipInstall = false;
let skipTests = false;
let help = false;
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--name":
      name = args[++i];
      if (!name || name.startsWith("-")) throw new Error("--name requires a package name");
      break;
    case "--dry-run": dryRun = true; break;
    case "--skip-install": skipInstall = true; break;
    case "--skip-tests": skipTests = true; break;
    case "--help": help = true; break;
    default: throw new Error(`Unknown argument: ${args[i]}`);
  }
}
if (help) {
  console.log("Usage: pnpm run setup [--name <package-name>] [--dry-run] [--skip-install] [--skip-tests]\n\nOptionally rename this package, install locked dependencies, and run its tests. No Pi configuration is changed.");
} else {
  if (name && (name.length > 214 || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name))) {
    throw new Error("Use a lowercase npm package name such as my-package or @scope/my-package");
  }
  const path = resolve(root, "package.json");
  const original = await readFile(path, "utf8");
  const pkg = JSON.parse(original) as { name: string };
  if (name && pkg.name !== name) {
    console.log(`${dryRun ? "Would rename" : "Renaming"} package: ${pkg.name} -> ${name}`);
    if (!dryRun) {
      // Change only the top-level name field, retaining the rest of the manifest's formatting.
      const updated = original.replace(/^(\s*)"name":\s*"[^"\\]*"/m, (_match, indentation: string) => `${indentation}"name": ${JSON.stringify(name)}`);
      if (updated === original) throw new Error("Could not safely update package name");
      await writeFile(path, updated);
    }
  } else {
    console.log(`Package name: ${pkg.name}${name ? " (unchanged)" : " (pass --name to customize)"}`);
  }
  function run(args: string[]) {
    const label = `pnpm ${args.join(" ")}`;
    console.log(`${dryRun ? "Would run" : "Running"}: ${label}`);
    if (dryRun) return;
    const result = spawnSync("pnpm", args, { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${label} failed (exit ${result.status ?? "unknown"})`);
  }
  if (!skipInstall) run(["install", "--frozen-lockfile"]);
  if (!skipTests) run(["test"]);
  if (dryRun) console.log("Dry run complete; no files changed or commands executed.");
  else if (skipInstall || skipTests) console.log("Setup finished with steps skipped; run them before relying on the package.");
  else console.log("Setup complete. Try the package with: pi -e .");
}
