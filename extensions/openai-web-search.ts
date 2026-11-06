import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const API_URL = "https://api.openai.com/v1/responses";
const CODEX_URL = "https://chatgpt.com/backend-api/codex/responses";

type Model = NonNullable<ExtensionContext["model"]>;

function official(model: Model, baseUrl: string): boolean {
	try {
		const url = new URL(baseUrl);
		return !url.username && !url.password && !url.search && !url.hash &&
			(model.provider === "openai" && model.api === "openai-responses" && url.href.replace(/\/+$/, "") === "https://api.openai.com/v1" ||
			 model.provider === "openai-codex" && model.api === "openai-codex-responses" && url.href.replace(/\/+$/, "") === "https://chatgpt.com/backend-api");
	} catch { return false; }
}

function accountId(token: string): string | undefined {
	try {
		const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
		const id = payload["https://api.openai.com/auth"]?.chatgpt_account_id;
		return typeof id === "string" && id.trim() ? id.trim() : undefined;
	} catch { return undefined; }
}

export async function search(query: string, ctx: Pick<ExtensionContext, "model" | "modelRegistry">, signal?: AbortSignal) {
	if (!query.trim()) throw new Error("Search query must not be empty");
	const models = ctx.modelRegistry.getAll().filter((m) => /^gpt-\d/i.test(m.id) && !/(?:^|-)(?:pro|ultra)(?:-|$)/i.test(m.id));
	const ordered = ["openai-codex", "openai"].flatMap((provider) => models.filter((m) => m.provider === provider).sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true })));
	const candidates = ctx.model && official(ctx.model, ctx.model.baseUrl) ? [ctx.model, ...ordered.filter((m) => m.id !== ctx.model?.id || m.provider !== ctx.model?.provider)] : ordered;
	for (const model of candidates) {
		if (!official(model, model.baseUrl)) continue;
		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		signal?.throwIfAborted();
		if (!auth.ok || !auth.apiKey || !official(model, auth.baseUrl ?? model.baseUrl)) continue;
		const codex = model.provider === "openai-codex";
		const headers = new Headers();
		for (const [name, value] of Object.entries(auth.headers ?? {})) if (value !== null) headers.set(name, value);
		headers.set("Authorization", `Bearer ${auth.apiKey}`);
		headers.set("Content-Type", "application/json");
		if (codex) {
			const id = accountId(auth.apiKey);
			if (id) headers.set("chatgpt-account-id", id);
			headers.set("originator", "pi");
		}
		const response = await fetch(codex ? CODEX_URL : API_URL, {
			method: "POST", headers, redirect: "error",
			signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
			body: JSON.stringify({ model: model.id, instructions: "Search the web and provide a concise answer grounded in results with clickable citations.", input: [{ role: "user", content: [{ type: "input_text", text: query }] }], tools: [{ type: "web_search" }], tool_choice: "required", include: ["web_search_call.action.sources"], store: false, stream: true }),
		});
		if (!response.ok) throw new Error(`OpenAI web search failed (HTTP ${response.status})`);
		return parseResponse(await response.text());
	}
	throw new Error("OpenAI web search requires Pi /login for OpenAI or OpenAI Codex with an official endpoint and a GPT model.");
}

export function parseResponse(text: string): string {
	let response: any;
	const items: any[] = [];
	let seenSearch = false;
	if (text.trimStart().startsWith("{")) {
		response = JSON.parse(text);
	} else {
		for (const line of text.split(/\r?\n/)) {
			if (!line.startsWith("data:")) continue;
			const data = line.slice(5).trim();
			if (!data || data === "[DONE]") continue;
			const event = JSON.parse(data);
			if (event.type === "error" || event.type === "response.failed" || event.type === "response.incomplete") throw new Error("OpenAI web search stream failed or was incomplete");
			if (event.type?.startsWith("response.web_search_call")) seenSearch = true;
			if (event.type === "response.output_item.done" && event.item) items.push(event.item);
			if (event.type === "response.completed" || event.type === "response.done") response = event.response;
		}
	}
	if (!response || response.error || (response.status && response.status !== "completed")) throw new Error("OpenAI web search did not complete successfully");
	const output: any[] = Array.isArray(response.output) && response.output.length ? response.output : items;
	if (!seenSearch && !output.some((item) => item?.type === "web_search_call")) throw new Error("OpenAI returned no web search call");
	const answers: string[] = [];
	const sources = new Map<string, string>();
	const add = (entry: any) => {
		if (typeof entry?.url !== "string") return;
		try { const url = new URL(entry.url); if (!["http:", "https:"].includes(url.protocol)) return; sources.set(url.href, typeof entry.title === "string" ? entry.title : url.href); } catch { /* ignore invalid URLs */ }
	};
	for (const item of output) {
		if (item?.type === "web_search_call") for (const source of item.action?.sources ?? []) add(source);
		if (item?.type === "message") for (const part of item.content ?? []) {
			if (typeof part.text === "string") answers.push(part.text);
			for (const citation of part.annotations ?? []) if (citation.type === "url_citation") add(citation);
		}
	}
	if (!answers.length && !sources.size) throw new Error("OpenAI web search returned no answer or sources");
	const result = `${answers.join("\n")}\n\nSources:\n${[...sources].slice(0, 20).map(([url, title]) => `- ${title}: ${url}`).join("\n")}`;
	return result.length > 30000 ? `${result.slice(0, 30000)}\n[Output truncated]` : result;
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "openai_web_search", label: "OpenAI Web Search",
		description: "Search the web with OpenAI hosted web_search and return a generated answer and source URLs. Output is limited to 30,000 characters.",
		promptSnippet: "Search the web using OpenAI and return an answer with sources",
		parameters: Type.Object({ query: Type.String({ description: "What to search for", minLength: 1 }) }),
		async execute(_id, { query }, signal, _update, ctx) {
			return { content: [{ type: "text", text: await search(query, ctx, signal) }], details: {} };
		},
	});
}
