import { isAbsolute, relative, resolve } from "node:path";
import type { ExtensionAPI, ToolAnnotations } from "@earendil-works/pi-coding-agent";

/**
 * Asks for approval before tool calls that are hard to undo, and blocks a few that are never wanted.
 * This guards against mistakes; it is not a security boundary (see pi's docs/security.md).
 */

export type Verdict = { kind: "allow" } | { kind: "ask" | "deny"; reason: string };

const DENY_BASH: [RegExp, string][] = [
	[/\brm\s+(?:-\S+\s+)*-(?:[a-zA-Z]*[rR][a-zA-Z]*|-recursive)\s+(?:-\S+\s+)*(?:\/|~|\$HOME)\/?\*?(?=$|[\s;&|])/, "rm -r on / or home"],
	[/--no-preserve-root\b/, "rm --no-preserve-root"],
];

const ASK_BASH: [RegExp, string][] = [
	[/\brm\s+(?:-\S+\s+)*-(?:[a-zA-Z]*[rRf][a-zA-Z]*|-recursive|-force)\b/, "rm -r / -f"],
	[/\bsudo\b/, "sudo"],
	[/\bgit\s+push\b.*\s(?:-f|--force(?:-with-lease)?)\b/, "git push --force"],
	[/\bgit\s+reset\s+.*--hard\b/, "git reset --hard"],
	[/\bgit\s+clean\s+.*-\S*f/, "git clean -f"],
	[/\bgit\s+branch\s+.*-D\b/, "git branch -D"],
	[/\bdd\s+.*\bof=/, "dd"],
	[/\bmkfs\b/, "mkfs"],
	[/\bch(?:mod|own)\s+(?:.*\s)?(?:-R\b|777\b)/, "recursive chmod/chown or 777"],
	[/\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/, "pipe download to shell"],
	[/\b(?:npm|pnpm|yarn|bun)\s+(?:publish|remove|rm|uninstall|un)\b/, "package publish/removal"],
	// Matched as command words so file names like migrate.py or deploy.yaml don't trigger.
	[/(?:^|[\s;&|:])(?:migrate|db\s+push)(?=$|[\s;&|:])/, "database migration"],
	[/\b(?:drop\s+(?:table|database|schema)|truncate\s+table)\b/i, "destructive SQL"],
	[/\b(?:kubectl\s+(?:delete|apply)|terraform\s+(?:apply|destroy)|helm\s+(?:install|upgrade|uninstall))\b/, "infrastructure change"],
	[/(?:^|[\s;&|:])deploy(?=$|[\s;&|:])/, "deploy"],
];

const PROTECTED_PATHS: [RegExp, string][] = [
	[/(?:^|\/)\.env(?:\.(?!example$)[^/]+)?$/, ".env file"],
	[/(?:^|\/)\.git\//, ".git directory"],
	[/(?:^|\/)\.ssh\//, ".ssh directory"],
	[/credentials[^/]*$/i, "credentials file"],
];

/** Tools that only read, or whose nested calls go through tool_call themselves. */
const SAFE_TOOLS = new Set(["read", "grep", "find", "ls", "codemode", "tool_search"]);

/** Exa search and page fetch are free to use; starting an agent run costs money, so it asks. */
const EXA_FREE_TOOLS = new Set(["mcp__exa__web_search_exa", "mcp__exa__web_fetch_exa"]);
const EXA_AGENT_RUN = "mcp__exa__agent_run";

export function classify(
	toolName: string,
	input: Record<string, unknown>,
	cwd: string,
	annotations: ToolAnnotations | undefined,
): Verdict {
	if (SAFE_TOOLS.has(toolName) || EXA_FREE_TOOLS.has(toolName)) return { kind: "allow" };
	// Resuming with runId only polls a run that was already approved.
	if (toolName === EXA_AGENT_RUN) return input.runId ? { kind: "allow" } : { kind: "ask", reason: "starts a paid Exa agent run" };

	if (toolName === "bash") {
		const command = String(input.command ?? "");
		for (const [pattern, reason] of DENY_BASH) if (pattern.test(command)) return { kind: "deny", reason };
		for (const [pattern, reason] of ASK_BASH) if (pattern.test(command)) return { kind: "ask", reason };
		return { kind: "allow" };
	}

	if (toolName === "write" || toolName === "edit") {
		const path = resolve(cwd, String(input.path ?? ""));
		for (const [pattern, reason] of PROTECTED_PATHS) if (pattern.test(path)) return { kind: "ask", reason };
		const rel = relative(cwd, path);
		if (rel.startsWith("..") || isAbsolute(rel)) return { kind: "ask", reason: "write outside working directory" };
		return { kind: "allow" };
	}

	// Other tools (MCP, extension tools): missing hints take MCP defaults (may be destructive, open world).
	if (annotations?.readOnlyHint) return { kind: "allow" };
	if (annotations?.destructiveHint ?? true) return { kind: "ask", reason: "may modify or delete data" };
	if (annotations?.openWorldHint ?? true) return { kind: "ask", reason: "reaches external services" };
	return { kind: "allow" };
}

const ALLOW_ONCE = "Allow";
const ALLOW_SESSION = "Allow for this session";
const REJECT = "Reject";

export default function (pi: ExtensionAPI) {
	let sessionAllowed = new Set<string>();

	pi.on("session_start", () => {
		sessionAllowed = new Set();
	});

	pi.on("tool_call", async (event, ctx) => {
		const annotations = pi.getAllTools().find((tool) => tool.name === event.toolName)?.annotations;
		const verdict = classify(event.toolName, event.input as Record<string, unknown>, ctx.cwd, annotations);
		if (verdict.kind === "allow") return;

		const key = `${event.toolName}: ${verdict.reason}`;
		if (verdict.kind === "deny") return { block: true, reason: `Blocked (${key}). Do not try to work around this.` };
		if (sessionAllowed.has(key)) return;
		if (!ctx.hasUI) return { block: true, reason: `Blocked (${key}): approval needs an interactive session.` };

		const summary = JSON.stringify(event.input, null, 2);
		const choice = await ctx.ui.select(`⚠️ Approval needed — ${key}\n\n${summary}`, [ALLOW_ONCE, ALLOW_SESSION, REJECT]);
		if (choice === ALLOW_SESSION) sessionAllowed.add(key);
		if (choice === ALLOW_ONCE || choice === ALLOW_SESSION) return;
		return {
			block: true,
			reason: `The user rejected this call (${key}). Do not retry it another way; ask the user how to proceed.`,
		};
	});
}
