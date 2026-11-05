import { Hono } from "hono";
import { createAuth } from "./features/auth/auth";
import { textRoutes } from "./features/ai-text/routes";
import { audioRoutes } from "./features/audio/routes";
import { coordinationRoutes } from "./features/coordination/routes";
import type { HonoEnv } from "./shared/app";
export { AudioWorkflow } from "./features/audio/workflow";
export { Coordinator } from "./features/coordination/coordinator";

const app = new Hono<HonoEnv>();
app.on(["POST", "GET"], "/api/auth/*", c => createAuth(c.env).handler(c.req.raw));
app.get("/api/health", c => c.json({ ok: true }));
app.use("/api/*", async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", session.user);
  await next();
});
app.route("/api/ai/text", textRoutes);
app.route("/api/audio/jobs", audioRoutes);
app.route("/api/coordination", coordinationRoutes);
app.notFound(c => c.json({ error: "Not found" }, 404));
app.onError((error, c) => { console.error("Request failed", error.name); return c.json({ error: "Request failed" }, 500); });
export default app;
