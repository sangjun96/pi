import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type Exec = ExtensionAPI["exec"];
type Installer = { command: string; args: string[]; prerequisite: string; missing: string };

// Add other platforms here without coupling their package managers to dictation.
export function installerFor(platform: NodeJS.Platform): Installer | undefined {
  if (platform === "darwin") return {
    command: "brew", args: ["install", "ffmpeg"], prerequisite: "brew",
    missing: "Homebrew was not found. Install Homebrew and ffmpeg manually, then retry /stt.",
  };
  return undefined;
}

async function available(exec: Exec, command: string, args: string[], signal: AbortSignal): Promise<boolean> {
  try {
    const result = await exec(command, args, { signal, timeout: 10_000, maxBuffer: 16_384 });
    return result.code === 0 && !result.killed;
  } catch { return false; }
}

export async function ensureFfmpeg(exec: Exec, ui: ExtensionContext["ui"], platform: NodeJS.Platform, signal: AbortSignal): Promise<boolean> {
  if (await available(exec, "ffmpeg", ["-version"], signal)) return true;
  if (signal.aborted) return false;
  const installer = installerFor(platform);
  if (!installer) {
    ui.notify("Automatic ffmpeg installation is only supported on macOS. Install ffmpeg manually and retry /stt.", "warning");
    return false;
  }
  if (!await available(exec, installer.prerequisite, ["--version"], signal)) {
    if (!signal.aborted) ui.notify(installer.missing, "error");
    return false;
  }
  if (signal.aborted) return false;
  const approved = await ui.confirm("Install ffmpeg?", "Run brew install ffmpeg? Homebrew may download packages and modify your system.", { signal });
  if (!approved || signal.aborted) return false;
  ui.notify("Installing ffmpeg with Homebrew; this may take several minutes.", "info");
  try {
    const result = await exec(installer.command, installer.args, { signal, timeout: 900_000, maxBuffer: 1_000_000 });
    if (signal.aborted) return false;
    if (result.code !== 0 || result.killed) {
      ui.notify("ffmpeg installation failed or timed out. Run brew install ffmpeg in a terminal to see details.", "error");
      return false;
    }
    if (!await available(exec, "ffmpeg", ["-version"], signal)) {
      if (!signal.aborted) ui.notify("ffmpeg was installed but is not on Pi's PATH. Update PATH and restart Pi.", "error");
      return false;
    }
    return !signal.aborted;
  } catch {
    if (!signal.aborted) ui.notify("Could not run Homebrew. Run brew install ffmpeg in a terminal and retry /stt.", "error");
    return false;
  }
}
