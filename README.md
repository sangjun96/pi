# Pi package starter

A reusable starting point for a [Pi package](https://github.com/earendil-works/pi). The default package exposes a small `/hello` extension command and an interactive `/setup-package` extension command. It does not register an MCP server, replace project instructions, or enable a permission gate by default.

```text
extensions/index.ts          # editable /hello extension command
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

In Pi, try `/hello` or `/hello Alice`. The `/setup-package` extension command prompts for a name and confirmation before executing the setup script. Run `/reload` after changing resources. Project-local packages require project trust. Review all package code before installing.

Change `name` and `description` in `package.json` (or use the setup script's `--name`), customize `extensions/index.ts`, and add resources under `skills/` or `prompts/`. The `pi` manifest selects the resources loaded from this package; add entries deliberately when creating new extensions.

## PDF skill

The `pdf` skill uses the `mupdf` runtime dependency to inspect PDFs, extract page text, and render pages to PNG. Invoke it with `/skill:pdf` or ask Pi to work with a PDF. Scanned pages need visual inspection or a separate OCR tool. The script does not overwrite existing output files.

MuPDF.js is available under the AGPL and commercial licenses. Review [Artifex's licensing terms](https://mupdf.com/licensing/) before distributing or deploying this package.

## Optional existing extensions

The previous custom extensions remain in `extensions/` for reference but are **not loaded** by the default manifest:

- `agents-md.ts` replaces every discovered `AGENTS.md`/`CLAUDE.md` with this package's `AGENTS.md`. This is intrusive; enable it only if that is intentional.
- `mcp.ts` registers Exa and its OAuth integration. Review and edit its server configuration before enabling it.
- `permission-gate.ts` implements an opinionated regex-based approval gate. Its rules are not a security boundary; inspect the source and tests before opting in.

To enable one, add its exact path to `pi.extensions` in `package.json` and reload Pi. Avoid a broad `extensions/*.ts` glob unless you intend to load all of them. The tests for the optional permission gate remain available via `pnpm test`.
