export interface AppEnv {
  DB: D1Database;
  AUDIO: R2Bucket;
  COORDINATOR: DurableObjectNamespace;
  AUDIO_JOBS: Workflow<{ jobId: string; text: string }>;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  OPENAI_API_KEY: string;
  GEMINI_API_KEY: string;
  OPENAI_MODEL: string;
  GEMINI_MODEL: string;
}
