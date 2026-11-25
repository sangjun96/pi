import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import mcp from "./mcp.ts";
import permissionGate from "./permission-gate.ts";

export default function (pi: ExtensionAPI) {
	mcp(pi);
	permissionGate(pi);
}
