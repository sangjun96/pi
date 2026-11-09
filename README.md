# Pi package starter

A starting point for a [Pi package](https://github.com/earendil-works/pi). The package enables extensions for Exa MCP, project-instruction replacement, web search, and a permission gate.

```text
extensions/                  # Pi extensions
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

## Try and customize

```bash
pi -e .                 # load this package for one session
pi install ./           # explicitly install it for the current user
# pi install -l ./      # alternatively install in the current project
```

Run `/reload` after changing resources. Project-local packages require project trust. Review all package code before installing.

Change `name` and `description` in `package.json` (or use the setup script's `--name`), customize the extensions, and add resources under `skills/` or `prompts/`. The `pi` manifest selects the resources loaded from this package; add entries deliberately when creating new extensions.

## PDF skill

The `pdf` skill uses the `mupdf` runtime dependency to inspect PDFs, extract page text, and render pages to PNG. Invoke it with `/skill:pdf` or ask Pi to work with a PDF. Scanned pages need visual inspection or a separate OCR tool. The script does not overwrite existing output files.

MuPDF.js is available under the AGPL and commercial licenses. Review [Artifex's licensing terms](https://mupdf.com/licensing/) before distributing or deploying this package.

## Grok voice dictation

The `stt.ts` extension records locally with `ffmpeg` and sends the audio to xAI's `grok-voice-transcribe-2.0` API. It inserts the transcript at the current editor cursor for review; it never submits it automatically. Audio leaves your machine and xAI API charges apply. The Pi chat model can be any provider.

1. Run `/stt`: if `ffmpeg` is missing on macOS, the extension offers to install it with Homebrew. Homebrew must already be installed and on Pi's PATH. On other systems, install `ffmpeg` manually. Grant your terminal microphone access when prompted.
2. Create an xAI API key. In Pi, run `/login xai` and choose API key; Pi stores it in its user-level `auth.json`. The extension resolves the xAI provider credential through Pi on macOS, Windows, and Linux. Alternatively set `XAI_API_KEY` before starting Pi. Pi's normal credential precedence applies: a stored credential takes precedence over the environment variable. Use `/logout` to remove the stored xAI credential (this also logs out xAI chat models). `auth.json` contains sensitive credentials in plain text, not an encrypted vault: protect your user account and the file, and never share or commit it. Pi also supports external secret-manager commands; see [Pi provider credentials](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md).
3. Load the package (`pi -e .`) or run `/reload` if already installed. Press **Cmd+R** to start, then again to stop. **Option+M** (Alt+M) is also available as a fallback. `/stt` also toggles; `/stt cancel` discards, `/stt status` reports state, and `/stt setup` checks dependencies without starting a recording.

Recordings are held in memory, capped at 120 seconds, and sent after stopping. At the limit they are sent automatically. The extension deletes no persistent audio files because it creates none. On macOS the default input is `:0`; list devices with `ffmpeg -f avfoundation -list_devices true -i ""`, then set `PI_STT_AUDIO_DEVICE=:1` (or the desired index) before starting Pi. Linux defaults to PulseAudio `default`, and Windows to DirectShow `audio=Microphone`; the same variable overrides the input. Cmd+R requires a terminal that forwards the Super/Command modifier (typically via the Kitty keyboard protocol); the terminal may reserve it for its own shortcut. Alt/Option+M and `/stt` are alternatives. Dictation requires Pi's interactive TUI and is not realtime streaming.

## Optional existing extensions

The following extensions are enabled in the manifest:

- `agents-md.ts` replaces every discovered `AGENTS.md`/`CLAUDE.md` with this package's `AGENTS.md`. This applies to every project where the package is loaded.
- `mcp.ts` registers Exa. Use `/mcp` in a loaded session to inspect its connection and sign in if needed. Shell-level `pi mcp list` does not load extensions.
- `permission-gate.ts` implements an opinionated regex-based approval gate. Its rules are not a security boundary; inspect the source and tests before opting in.

Each extension is listed directly in the manifest. Run `/reload` after changing the manifest. The permission gate tests are available via `pnpm test`.
