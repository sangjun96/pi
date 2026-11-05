import { Hono } from "hono";
import OpenAI from "openai";
import { z } from "zod";
import type { HonoEnv } from "../../shared/app";

const input = z.object({ text: z.string().trim().min(1).max(4000) });
export const textRoutes = new Hono<HonoEnv>();
textRoutes.post("/", async c => {
  const parsed = input.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);
  const result = await new OpenAI({ apiKey: c.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 0 }).responses.create({ model: c.env.OPENAI_MODEL, input: parsed.data.text, max_output_tokens: 1024 });
  return c.json({ text: result.output_text });
});
