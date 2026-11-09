import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import register from "../extensions/grok-media.ts";

type Tool = { name: string; execute: (...args: any[]) => Promise<any> };
const tools: Record<string, Tool> = {};
register({ registerTool(tool: Tool) { tools[tool.name] = tool; } } as unknown as ExtensionAPI);
const dirs: string[] = [];
async function setup() {
  const cwd = await mkdtemp(join(tmpdir(), "grok-media-"));
  dirs.push(cwd);
  const ctx = { cwd, modelRegistry: { getProviderAuth: async () => ({ auth: { apiKey: "secret" } }) } };
  return { cwd, ctx };
}
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

test("generates image using base64 API and saves actual image format", async () => {
  const { cwd, ctx } = await setup();
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x01]);
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: bytes.toString("base64") }] })));
  vi.stubGlobal("fetch", fetchMock);
  const signal = new AbortController().signal;
  const result = await tools.grok_image.execute("id", { prompt: "cat", path: "out.png", aspect_ratio: "16:9" }, signal, undefined, ctx);
  expect(await readFile(join(cwd, "out.png.jpg"))).toEqual(bytes);
  expect(result.details.path).toBe(join(cwd, "out.png.jpg"));
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.x.ai/v1/images/generations");
  expect(options.signal).toBe(signal);
  expect(options.headers.Authorization).toBe("Bearer secret");
  expect(JSON.parse(options.body)).toMatchObject({ model: "grok-imagine-image-2.0", prompt: "cat", n: 1, response_format: "b64_json", aspect_ratio: "16:9" });
});

test("TTS sends speech parameters and saves raw bytes", async () => {
  const { cwd, ctx } = await setup();
  const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetchMock);
  await tools.grok_tts.execute("id", { text: "안녕하세요", path: "audio/test.wav", language: "ko", voice_id: "ara", speed: 1.2 }, undefined, undefined, ctx);
  expect(await readFile(join(cwd, "audio/test.wav"))).toEqual(Buffer.from([1, 2, 3]));
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.x.ai/v1/tts");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ text: "안녕하세요", language: "ko", voice_id: "ara", speed: 1.2, output_format: { codec: "wav" } });
});

test("rejects existing files before billing and masks API errors", async () => {
  const { cwd, ctx } = await setup();
  await writeFile(join(cwd, "out.mp3"), "existing");
  const fetchMock = vi.fn().mockResolvedValue(new Response("secret detail", { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(tools.grok_tts.execute("id", { text: "hi", path: "out.mp3" }, undefined, undefined, ctx)).rejects.toThrow("already exists");
  expect(fetchMock).not.toHaveBeenCalled();
  await expect(tools.grok_tts.execute("id", { text: "hi", path: "new.mp3" }, undefined, undefined, ctx)).rejects.toThrow("HTTP 401");
  expect(await readFile(join(cwd, "out.mp3"), "utf8")).toBe("existing");
});

test("rejects missing auth and malformed image data", async () => {
  const { ctx } = await setup();
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{}] })));
  vi.stubGlobal("fetch", fetchMock);
  await expect(tools.grok_image.execute("id", { prompt: "cat", path: "cat.jpg" }, undefined, undefined, { ...ctx, modelRegistry: { getProviderAuth: async () => undefined } })).rejects.toThrow("API key missing");
  expect(fetchMock).not.toHaveBeenCalled();
  await expect(tools.grok_image.execute("id", { prompt: "cat", path: "cat.jpg" }, undefined, undefined, ctx)).rejects.toThrow("no valid image data");
});
