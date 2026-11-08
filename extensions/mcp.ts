import type { ExtensionAPI, McpServerConfig } from "@earendil-works/pi-coding-agent";

/**
 * MCP servers this package registers. To add one, add an entry here.
 *
 * Remote servers without an `Authorization` header sign in with OAuth: run `/mcp login <name>`
 * (or pick "Sign in" in `/mcp`) inside a pi session. Tokens are stored in `~/.pi/agent/mcp-auth.json`.
 * The `pi mcp` shell commands do not load extensions, so they don't list these servers.
 */
export const MCP_SERVERS: Record<string, McpServerConfig> = {
	// exa: {
	// 	url: "https://mcp.exa.ai/mcp?login",
	// 	exposure: "direct",
	// 	description: "Web search and clean page fetch via Exa",
	// },
};

export default function (pi: ExtensionAPI) {
	for (const [name, config] of Object.entries(MCP_SERVERS)) {
		pi.registerMcpServer(name, config);
	}
}
