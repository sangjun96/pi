import { afterEach, describe, expect, it, vi } from "vitest";
import { parseResponse, search } from "../extensions/openai-web-search.ts";

const output = [
	{ type: "web_search_call", action: { sources: [{ url: "https://example.com/", title: "Example" }] } },
	{ type: "message", content: [{ text: "Answer", annotations: [] }] },
];
const model = { id: "gpt-5", provider: "openai", api: "openai-responses", baseUrl: "https://api.openai.com/v1" };
function context(baseUrl = model.baseUrl) {
	return { model, modelRegistry: { getAll: () => [model], getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "secret", baseUrl }) } } as any;
}
afterEach(() => vi.unstubAllGlobals());
describe("OpenAI web search", () => {
	it("parses JSON and citations", () => {
		expect(parseResponse(JSON.stringify({ status: "completed", output }))).toContain("Example: https://example.com/");
	});
	it("parses completed SSE and rejects failure or missing search", () => {
		expect(parseResponse(`data: ${JSON.stringify({ type: "response.completed", response: { status: "completed", output } })}\n\n`)).toContain("Answer");
		expect(() => parseResponse('data: {"type":"response.failed"}\n')).toThrow();
		expect(() => parseResponse(JSON.stringify({ output: [output[1]] }))).toThrow();
	});
	it("sends search to the official endpoint without redirects", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output })));
		vi.stubGlobal("fetch", fetchMock);
		expect(await search("test", context())).toContain("Answer");
		expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
		expect(fetchMock.mock.calls[0][1].redirect).toBe("error");
	});
	it("never sends credentials when the resolved base URL is custom", async () => {
		const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
		await expect(search("test", context("https://evil.example/v1"))).rejects.toThrow();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
