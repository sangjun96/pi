import { afterEach, expect, test, vi } from "vitest";
import { captureArgs, transcribe } from "../extensions/stt.ts";

afterEach(() => vi.unstubAllGlobals());

test("capture uses a bounded mono WAV stream and accepts a device override", () => {
  const args = captureArgs("darwin", ":1");
  expect(args).toContain(":1");
  expect(args.slice(-3)).toEqual(["-f", "wav", "pipe:1"]);
  expect(args).toContain("120");
  expect(captureArgs("linux")).toContain("pulse");
  expect(() => captureArgs("freebsd")).toThrow("not supported");
});

test("sends the xAI model and audio last with bearer authentication", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "  hello world  " })));
  vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController();
  expect(await transcribe(new Uint8Array([1, 2]), "test-secret", controller.signal)).toBe("hello world");
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.x.ai/v1/stt");
  expect(options.headers.Authorization).toBe("Bearer test-secret");
  expect(options.signal).toBe(controller.signal);
  expect([...options.body.keys()]).toEqual(["model", "file"]);
  expect(options.body.get("model")).toBe("grok-voice-transcribe-2.0");
});

test("does not expose response body on HTTP failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("sensitive server response", { status: 401 })));
  await expect(transcribe(new Uint8Array(), "key", new AbortController().signal)).rejects.toThrow("HTTP 401");
});

test("rejects malformed responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 42 }))));
  await expect(transcribe(new Uint8Array(), "key", new AbortController().signal)).rejects.toThrow("invalid transcription");
});
