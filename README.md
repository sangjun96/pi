# Pi package starter

A starting point for a [Pi package](https://github.com/earendil-works/pi). The package enables all current extensions: `/setup-package`, Exa MCP, project-instruction replacement, and a permission gate.

```text
extensions/setup-package.ts  # interactive /setup-package command
skills/                      # add skills here
scripts/setup.ts             # local package setup
AGENTS.md                    # instructions for agents working on this checkout
```

## Set up this package

Requires Node.js 22.18+ and pnpm. From this directory:

```bash
pnpm run setup
# Optional: pnpm run setup --name @your-scope/your-package
```

The script optionally updates the package name, installs dependencies from the lockfile, and runs tests. It does not install the package into Pi, change Pi configuration, or access credentials. Rerunning without `--name` preserves the current name. Use `--dry-run` to preview, or `--skip-install` / `--skip-tests` to skip individual steps. Setup can access the package registry during dependency installation.

To set up interactively, load this package and use `/setup-package` while Pi's working directory is this checkout. Enter a package name or leave it blank to keep the current name, then confirm the setup. The command runs the script and reports the outcome without using an agent turn.

## Try and customize

```bash
pi -e .                 # load this package for one session
pi install ./           # explicitly install it for the current user
# pi install -l ./      # alternatively install in the current project
```

In Pi, the `/setup-package` extension command prompts for a name and confirmation before executing the setup script. Run `/reload` after changing resources. Project-local packages require project trust. Review all package code before installing.

Change `name` and `description` in `package.json` (or use the setup script's `--name`), customize the extensions, and add resources under `skills/` or `prompts/`. The `pi` manifest selects the resources loaded from this package; add entries deliberately when creating new extensions.

## Enabled extensions

The following extensions are enabled in the manifest:

- `agents-md.ts` replaces every discovered `AGENTS.md`/`CLAUDE.md` with this package's `AGENTS.md`. This applies to every project where the package is loaded.
- `mcp.ts` registers Exa. Use `/mcp` in a loaded session to inspect its connection and sign in if needed. Shell-level `pi mcp list` does not load extensions.
- `permission-gate.ts` implements an opinionated regex-based approval gate. Its rules are not a security boundary; inspect the source and tests before opting in.

Each extension is listed directly in the manifest. Run `/reload` after changing the manifest. The permission gate tests are available via `pnpm test`.
