import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { spawn, type ChildProcess } from "node:child_process";
import { ensureFfmpeg } from "./stt-installer.ts";

const MODEL = "grok-voice-transcribe-2.0";
const ENDPOINT = "https://api.x.ai/v1/stt";
const MAX_AUDIO_BYTES = 4_000_000; // 120 seconds of 16 kHz mono PCM plus WAV header

type Phase = "idle" | "preparing" | "recording" | "transcribing";

export function captureArgs(platform: NodeJS.Platform, device?: string): string[] {
  const source = platform === "darwin" ? ["avfoundation", device || ":0"]
    : platform === "linux" ? ["pulse", device || "default"]
    : platform === "win32" ? ["dshow", device || "audio=Microphone"] : undefined;
  if (!source) throw new Error(`Microphone capture is not supported on ${platform}`);
  return ["-hide_banner", "-loglevel", "error", "-f", source[0], "-i", source[1],
    "-t", "120", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"];
}

export async function transcribe(audio: Uint8Array, key: string, signal: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append("model", MODEL);
  // xAI requires the file to be the final multipart field. Omit language for auto-detection.
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "recording.wav");
  const response = await fetch(ENDPOINT, {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal,
  });
  // Avoid displaying response bodies: they may contain sensitive data.
  if (!response.ok) throw new Error(`xAI transcription failed (HTTP ${response.status})`);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("text" in result) || typeof result.text !== "string") {
    throw new Error("xAI returned an invalid transcription response");
  }
  return result.text.trim();
}

export default function sttExtension(pi: ExtensionAPI) {
  let phase: Phase = "idle";
  let generation = 0;
  let recorder: ChildProcess | undefined;
  let controller: AbortController | undefined;
  let animation: ReturnType<typeof setInterval> | undefined;
  let killTimer: ReturnType<typeof setTimeout> | undefined;

  function clearUI(ctx: ExtensionContext) {
    if (animation) clearInterval(animation);
    animation = undefined;
    ctx.ui.setWidget("grok-stt", undefined);
    ctx.ui.setStatus("grok-stt", undefined);
  }

  function show(ctx: ExtensionContext, label: string) {
    if (animation) clearInterval(animation);
    let frame = 0;
    const frames = ["▁▃▅▃▁", "▂▄▇▄▂", "▃▆█▆▃", "▂▅▇▅▂"];
    const draw = () => {
      const t = ctx.ui.theme;
      ctx.ui.setWidget("grok-stt", [
        `${t.fg("accent", t.bold(" ◉ GROK VOICE"))}  ${t.fg("muted", frames[frame++ % frames.length])}  ${t.fg("text", label)}`,
        t.fg("dim", "   Cmd+R / Alt+M stop  ·  /stt cancel discard  ·  audio sent to xAI"),
      ]);
      ctx.ui.setStatus("grok-stt", t.fg("accent", `● ${label}`));
    };
    draw();
    animation = setInterval(draw, 250);
  }

  function cancel(ctx: ExtensionContext, notify = true) {
    generation++;
    controller?.abort();
    controller = undefined;
    if (recorder) {
      recorder.kill("SIGKILL");
      recorder = undefined;
    }
    if (killTimer) clearTimeout(killTimer);
    killTimer = undefined;
    phase = "idle";
    clearUI(ctx);
    if (notify) ctx.ui.notify("Voice dictation cancelled.", "info");
  }

  async function prepare(ctx: ExtensionContext, signal: AbortSignal): Promise<string | undefined> {
    if (!await ensureFfmpeg(pi.exec, ctx.ui, process.platform, signal) || signal.aborted) return;
    const key = (await ctx.modelRegistry.getProviderAuth("xai"))?.auth.apiKey?.trim();
    if (signal.aborted) return;
    if (!key) {
      ctx.ui.notify("No xAI API key. Run /login xai and choose API key, then retry /stt. Microphone access may also be requested by macOS.", "warning");
      return;
    }
    return key;
  }

  async function toggle(ctx: ExtensionContext, setupOnly = false) {
    if (ctx.mode !== "tui") return;
    if (phase === "recording") {
      phase = "transcribing"; // lock immediately against repeated shortcut presses
      show(ctx, "Finishing recording…");
      const active = recorder;
      active?.kill("SIGINT");
      killTimer = setTimeout(() => active?.kill("SIGKILL"), 3000);
      return;
    }
    if (phase !== "idle") {
      ctx.ui.notify("Voice is busy. Use /stt cancel to discard.", "warning");
      return;
    }
    if (!ctx.isIdle()) {
      ctx.ui.notify("Wait until Pi is idle before recording.", "warning");
      return;
    }
    phase = "preparing";
    const current = ++generation;
    show(ctx, "Preparing microphone…");
    try {
      const request = new AbortController();
      controller = request;
      const key = await prepare(ctx, request.signal);
      if (current !== generation) return;
      controller = undefined;
      if (!key || setupOnly) {
        phase = "idle";
        clearUI(ctx);
        if (key) ctx.ui.notify("STT dependencies are ready. Run /stt to record; allow microphone access if prompted.", "info");
        return;
      }
      const args = captureArgs(process.platform, process.env.PI_STT_AUDIO_DEVICE);
      const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
      recorder = child;
      const chunks: Buffer[] = [];
      let size = 0;
      let stderr = "";
      let spawnError: Error | undefined;
      child.on("error", (error) => { spawnError = error; });
      child.stdout?.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_AUDIO_BYTES) { child.kill("SIGKILL"); return; }
        chunks.push(chunk);
      });
      child.stderr?.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-2000); });
      phase = "recording";
      show(ctx, "Recording · Cmd+R / Alt+M to stop");
      child.on("close", async (code, signal) => {
        if (current !== generation) return;
        if (killTimer) clearTimeout(killTimer);
        killTimer = undefined;
        recorder = undefined;
        try {
          if (spawnError) throw new Error("Could not start ffmpeg. Install it and ensure it is on PATH.");
          if (size > MAX_AUDIO_BYTES) throw new Error("Recording exceeded the size limit.");
          // ffmpeg can return 255 after our SIGINT; a natural 120-second stop returns 0.
          if (code !== 0 && !(phase === "transcribing" && (code === 255 || signal === "SIGINT"))) {
            throw new Error(`Microphone recording failed${stderr.trim() ? `: ${stderr.trim()}` : "."} Check microphone permission for your terminal and PI_STT_AUDIO_DEVICE.`);
          }
          if (size < 4096) throw new Error("Recording was too short or no microphone audio was captured.");
          phase = "transcribing";
          show(ctx, "Transcribing with xAI…");
          const request = new AbortController();
          controller = request;
          const timeout = setTimeout(() => request.abort(), 60_000);
          let text: string;
          try { text = await transcribe(Buffer.concat(chunks), key, request.signal); }
          finally { clearTimeout(timeout); }
          if (current !== generation) return;
          if (!text) throw new Error("No speech detected. Check the microphone and try again.");
          // Insert at the current cursor, retaining edits made while recording.
          ctx.ui.pasteToEditor(text);
          ctx.ui.notify("Transcript inserted. Review it before sending.", "info");
        } catch (error) {
          if (current === generation) ctx.ui.notify(error instanceof Error ? error.message : "Transcription failed.", "error");
        } finally {
          if (current === generation) {
            controller = undefined;
            phase = "idle";
            clearUI(ctx);
          }
        }
      });
    } catch (error) {
      if (current !== generation) return;
      controller = undefined;
      phase = "idle";
      clearUI(ctx);
      ctx.ui.notify(error instanceof Error ? error.message : "Could not start recording.", "error");
    }
  }

  pi.registerShortcut("super+r", { description: "Toggle Grok voice dictation (Cmd+R)", handler: toggle });
  pi.registerShortcut("alt+m", { description: "Toggle Grok voice dictation (fallback)", handler: toggle });
  pi.registerCommand("stt", {
    description: "Grok voice dictation: toggle, cancel, setup, or status",
    handler: async (args, ctx) => {
      const action = args.trim();
      if (!action || action === "toggle") return toggle(ctx);
      if (action === "cancel") return cancel(ctx);
      if (action === "status") return ctx.ui.notify(`Grok voice: ${phase}. Cmd+R or Alt+M toggles recording.`, "info");
      if (action === "setup") return toggle(ctx, true);
      ctx.ui.notify("Usage: /stt [toggle|cancel|status|setup]", "warning");
    },
  });
  pi.on("session_shutdown", (_event, ctx) => cancel(ctx, false));
}
