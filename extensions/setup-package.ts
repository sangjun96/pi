import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { cp, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const template = join(dirname(fileURLToPath(import.meta.url)), "..", "template", "cloudflare-full-stack");
const excluded = new Set(["node_modules", ".git", ".wrangler", ".dev.vars", "dist"]);

export default function setupPackage(pi: ExtensionAPI) {
  pi.registerCommand("setup-package", {
    description: "Create a Cloudflare project in the current directory",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) throw new Error("/setup-package requires an interactive UI");
      if (args.trim()) {
        ctx.ui.notify("Use /setup-package without arguments.", "warning");
        return;
      }
      try {
        const entries = (await readdir(template)).filter(name => !excluded.has(name));
        const existing = new Set(await readdir(ctx.cwd));
        const conflicts = entries.filter(name => existing.has(name));
        if (conflicts.length) throw new Error(`Existing paths would conflict: ${conflicts.join(", ")}. Use an empty directory (a .git directory is allowed).`);
        const confirmed = await ctx.ui.confirm("Create Cloudflare project?", `Copy the Cloudflare template into ${ctx.cwd}. Existing files will not be overwritten. Dependencies will not be installed.`);
        if (!confirmed) return;
        for (const entry of entries) {
          await cp(join(template, entry), join(ctx.cwd, entry), {
            recursive: true, force: false, errorOnExist: true,
            filter: source => !excluded.has(source.split(/[\\/]/).pop()!),
          });
        }
        ctx.ui.notify(`Cloudflare project created in ${ctx.cwd}. Run pnpm run setup there to install dependencies and apply local D1 migrations.`, "info");
      } catch (error) {
        ctx.ui.notify(`Could not create Cloudflare project in ${ctx.cwd}: ${error instanceof Error ? error.message : String(error)}. Some files may have been copied.`, "error");
      }
    },
  });
}
