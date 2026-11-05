import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  server: { port: 5188, strictPort: true },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src/client") } },
});
