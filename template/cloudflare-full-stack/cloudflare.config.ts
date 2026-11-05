import { bindings, defineConfig, exports } from "cf/config";
import { LOCAL_DATABASE_ID, requireRemoteTarget } from "./scripts/target.ts";

export default defineConfig(({ mode }) => {
  const remote = mode === "remote";
  const target = remote ? requireRemoteTarget() : undefined;
  const workerName = remote ? process.env.CLOUDFLARE_WORKER_NAME : "cloudflare-full-stack";
  const bucketName = remote ? process.env.CLOUDFLARE_R2_BUCKET : "app-audio";
  const workflowName = remote ? process.env.CLOUDFLARE_WORKFLOW_NAME : "app-audio-jobs";
  const authUrl = remote ? process.env.BETTER_AUTH_URL : "http://localhost:5188";
  if (!workerName || !bucketName || !workflowName || !authUrl) throw new Error("Remote configuration requires CLOUDFLARE_WORKER_NAME, CLOUDFLARE_R2_BUCKET, CLOUDFLARE_WORKFLOW_NAME and BETTER_AUTH_URL");
  if (remote && new URL(authUrl).protocol !== "https:") throw new Error("BETTER_AUTH_URL must use HTTPS remotely");
  return {
    ...(target ? { accountId: target.accountId } : {}),
    worker: {
      name: workerName,
      entrypoint: "./src/server/index.ts",
      compatibilityDate: "2026-10-06",
      compatibilityFlags: ["nodejs_compat"],
      assets: { notFoundHandling: "single-page-application", runWorkerFirst: ["/api/*"] },
      env: {
        DB: bindings.d1({ id: target?.databaseId ?? LOCAL_DATABASE_ID, name: "app-db" }),
        AUDIO: bindings.r2({ name: bucketName }),
        COORDINATOR: bindings.durableObject({ worker: workerName, exportName: "Coordinator" }),
        AUDIO_JOBS: bindings.workflow({ name: workflowName, worker: workerName, exportName: "AudioWorkflow" }),
        BETTER_AUTH_SECRET: bindings.secret(), BETTER_AUTH_URL: bindings.text(authUrl),
        OPENAI_API_KEY: bindings.secret(), GEMINI_API_KEY: bindings.secret(),
        OPENAI_MODEL: bindings.text(process.env.OPENAI_MODEL || "gpt-6.1-terra"),
        GEMINI_MODEL: bindings.text(process.env.GEMINI_MODEL || "gemini-3.8-flash-lite-tts"),
      },
      exports: {
        Coordinator: exports.durableObject({ storage: "sqlite" }),
        AudioWorkflow: exports.workflow({ name: workflowName }),
      },
    },
  };
});
