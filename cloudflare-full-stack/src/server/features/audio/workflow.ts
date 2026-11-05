import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { GoogleGenAI } from "@google/genai";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { audioJob } from "../../shared/schema";
import type { AppEnv } from "../../shared/env";

type Params = { jobId: string; text: string };
export class AudioWorkflow extends WorkflowEntrypoint<AppEnv, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { jobId, text } = event.payload;
    const db = drizzle(this.env.DB);
    const objectKey = `audio/${jobId}.wav`;
    try {
      await step.do("generate and store audio", async () => {
        const existing = await this.env.AUDIO.head(objectKey);
        if (existing) return;
        const client = new GoogleGenAI({ apiKey: this.env.GEMINI_API_KEY });
        const result = await client.interactions.create({
          model: this.env.GEMINI_MODEL,
          input: [{ type: "user_input", content: [{ type: "text", text }] }],
          response_format: { type: "audio", mime_type: "audio/wav" },
          generation_config: { speech_config: [{ voice: "Kore" }] },
        });
        const data = result.output_audio?.data;
        if (!data) throw new Error("Provider returned no audio");
        const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
        await this.env.AUDIO.put(objectKey, bytes, { httpMetadata: { contentType: "audio/wav" } });
      });
      await step.do("mark complete", async () => {
        await db.update(audioJob).set({ status: "complete", objectKey }).where(eq(audioJob.id, jobId));
      });
    } catch (error) {
      await db.update(audioJob).set({ status: "failed" }).where(eq(audioJob.id, jobId));
      throw error;
    }
  }
}
