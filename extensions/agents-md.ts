import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AGENTS_MD_PATH = fileURLToPath(new URL("../AGENTS.md", import.meta.url));

/** Replace all discovered context files (AGENTS.md / CLAUDE.md) with this package's AGENTS.md. */
export default function (pi: ExtensionAPI) {
	const content = readFileSync(AGENTS_MD_PATH, "utf8");

	pi.on("before_agent_start", (event) => {
		event.systemPromptOptions.contextFiles = [{ path: AGENTS_MD_PATH, content }];
	});
}
