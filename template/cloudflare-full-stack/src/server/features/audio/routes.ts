import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { HonoEnv } from "../../shared/app";
import { audioJob } from "../../shared/schema";

const input = z.object({ text: z.string().trim().min(1).max(4000) });
export const audioRoutes = new Hono<HonoEnv>();
audioRoutes.post("/", async c => {
  const parsed = input.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);
  const id = crypto.randomUUID();
  const db = drizzle(c.env.DB);
  await db.insert(audioJob).values({ id, userId: c.get("user").id, status: "pending", createdAt: new Date() });
  try { await c.env.AUDIO_JOBS.create({ id, params: { jobId: id, text: parsed.data.text } }); }
  catch { await db.update(audioJob).set({ status: "failed" }).where(eq(audioJob.id, id)); return c.json({ error: "Could not start job" }, 503); }
  return c.json({ id, status: "pending" }, 202);
});
audioRoutes.get("/:id", async c => {
  const job = await drizzle(c.env.DB).select().from(audioJob).where(and(eq(audioJob.id, c.req.param("id")), eq(audioJob.userId, c.get("user").id))).get();
  if (!job) return c.json({ error: "Not found" }, 404);
  return c.json({ id: job.id, status: job.status });
});
audioRoutes.get("/:id/audio", async c => {
  const job = await drizzle(c.env.DB).select().from(audioJob).where(and(eq(audioJob.id, c.req.param("id")), eq(audioJob.userId, c.get("user").id))).get();
  if (!job?.objectKey || job.status !== "complete") return c.json({ error: "Not found" }, 404);
  const object = await c.env.AUDIO.get(job.objectKey);
  if (!object) return c.json({ error: "Not found" }, 404);
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store" } });
});
