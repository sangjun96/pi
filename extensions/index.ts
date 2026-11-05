import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import setupPackage from "./setup-package.ts";

export default function (pi: ExtensionAPI) {
	setupPackage(pi);
	pi.registerCommand("hello", {
		description: "Show a greeting",
		handler: async (name, ctx) => {
			ctx.ui.notify(`Hello, ${name || "world"}!`, "info");
		},
	});
}
