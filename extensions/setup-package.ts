import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

export default function setupPackage(pi: ExtensionAPI) {
  pi.registerCommand("setup-package", {
    description: "Interactively set up the package in the current directory",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) throw new Error("/setup-package requires an interactive UI");
      if (args.trim()) {
        ctx.ui.notify("Use /setup-package without arguments; enter the package name when prompted.", "warning");
        return;
      }
      try {
        await access(join(ctx.cwd, "scripts/setup.ts"));
        const pkg = JSON.parse(await readFile(join(ctx.cwd, "package.json"), "utf8"));
        if (typeof pkg.name !== "string" || pkg.scripts?.setup !== "node scripts/setup.ts") throw new Error("not a package starter checkout");
        const input = await ctx.ui.input("Package name (leave blank to keep current)", pkg.name);
        if (input === undefined) return;
        const name = input.trim();
        if (name && (name.length > 214 || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name))) {
          ctx.ui.notify("Invalid name. Use a lowercase npm package name such as my-package or @scope/my-package.", "error");
          return;
        }
        const commandArgs = ["run", "setup", ...(name ? ["--name", name] : [])];
        const confirmed = await ctx.ui.confirm("Run package setup?", `In ${ctx.cwd}, run pnpm ${commandArgs.join(" ")}. This installs dependencies and runs tests.`);
        if (!confirmed) return;
        ctx.ui.notify("Running package setup; installing dependencies and running tests...", "info");
        const result = await pi.exec("pnpm", commandArgs, { cwd: ctx.cwd });
        if (result.code !== 0 || result.killed || result.truncated) {
          ctx.ui.notify(`Setup failed (exit ${result.code}). Install or tests may not have completed.\n${result.stderr || result.stdout}`, "error");
          return;
        }
        ctx.ui.notify("Setup complete: dependencies installed and tests passed.", "info");
      } catch (error) {
        ctx.ui.notify(`Setup could not run in ${ctx.cwd}: ${error instanceof Error ? error.message : String(error)}. Open the package checkout and try again.`, "error");
      }
    },
  });
}
