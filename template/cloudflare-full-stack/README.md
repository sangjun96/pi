# Cloudflare full-stack template (work in progress)

React/Vite + Cloudflare Workers, D1, R2, Durable Objects, Workflows, Better Auth, Drizzle, OpenAI and Gemini TTS. Uses the beta `cf` CLI and Cloudflare Vite plugin v2, not a Wrangler configuration. **This is not ready for production or deployment.** In particular, end-to-end and security tests, and remote provisioning/deploy automation are not finished. Public sign-up is disabled; operators create accounts using the scripts below.

## Local setup

Requires Node 22.18+ and pnpm. From this directory:

```sh
pnpm run setup             # installs locked dependencies, prepares local secrets and applies local migrations
pnpm account:create:local  # interactive; enter email, name and password yourself
pnpm dev
```

`pnpm run setup` is safe to rerun: it leaves an existing `.dev.vars` untouched and applies only pending **local** migrations. It creates a random local auth secret if needed, never creates an account, and does not provision or modify remote resources. AI keys are left blank. Use `pnpm run setup --dry-run` to preview, or `--skip-install` / `--skip-migrate` when appropriate. Do not print or commit `.dev.vars`.

### Agent command

When using Pi from this project directory, grant project trust and run `/reload` if the session is already open. The `/setup-project` prompt command tells the agent to announce and run `pnpm run setup`, report the outcome, and leave account creation to you. Other coding agents should follow `AGENTS.md`. No agent needs to see your password or API keys.

Visit http://localhost:5188. The local D1 ID is a fixed placeholder and `.cloudflare/state` is local-only. The migration command uses `cf --local --persist-to .cloudflare/state`; the Vite plugin also uses `.cloudflare/state/v3`. A migration and subsequent Better Auth login query were tested against this local state. Never use the placeholder ID for a remote database. `.dev.vars` and local state must not be committed. OpenAI/Gemini keys are optional for startup but required for their features.

Stop the dev server while creating local accounts. The operator script uses an isolated, CLI-only Better Auth admin instance with no admin endpoints exposed in the Worker; it uses the same local D1 persistence path as the dev server. Passwords are entered twice with terminal echo disabled, not passed as arguments. `pnpm test`, `pnpm typecheck` and `pnpm build` run separately. The optional AI example UI lives in `src/client/features/ai-text/GenerationExamples.tsx`; remove its import and usage from `src/client/app/App.tsx` to start with an empty authenticated shell. The corresponding server features remain independent. The copied shadcn components use semantic light/dark tokens; the theme toggle saves the selection locally. The included CI workflow runs these checks when this directory is used as the root of its own repository. `pnpm db:generate` creates Drizzle SQL under `migrations/`; `cf` is the only migration runner. Commit generated SQL and Drizzle metadata together. Back up remote databases and test migrations on a disposable database before applying them.

## Remote (not yet validated)

Create your own D1 database, R2 bucket and Workflow/Worker resources using `cf` after approval; set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_WORKER_NAME`, `CLOUDFLARE_WORKFLOW_NAME` and `BETTER_AUTH_URL` to the deployed HTTPS origin when building/configuring. Configure the three secret bindings (`BETTER_AUTH_SECRET`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) using supported `cf` secret-file tooling or another documented Cloudflare mechanism. Do not expose these values through Vite environment variables or commit them. Use unique Worker and Workflow names for your account. The remote configuration is selected explicitly with `--mode remote`; without it, the config uses local placeholder resources, so do not run an unqualified deploy.

The TypeScript migration scripts use the local dev database ID for local, regardless of remote environment variables. `pnpm db:migrate:remote` requires a valid non-placeholder ID, account ID, an interactive terminal, and a typed database ID confirmation. It modifies the selected real database and may incur charges. `pnpm account:create:remote` additionally requires `CLOUDFLARE_API_TOKEN` with D1 write permission, a terminal and the same target confirmation; it talks to Cloudflare's D1 raw HTTP API using a CLI-only Better Auth instance. Neither script accepts a password as a command-line argument. Both refuse remote operations if TLS verification is disabled. Never run without authorization. Remote account creation has been tested against a local D1 simulation but not a live Cloudflare account; remote deployment and migration are also unverified. Do not deploy until deployment safeguards and security tests are complete. Consult [cf documentation](https://developers.cloudflare.com/cf/) and [programmatic configuration](https://developers.cloudflare.com/cf/projects/cloudflare-config/) for current beta behavior.

## Features and limitations

- Public email/password registration is disabled in Better Auth. Operators create accounts using Better Auth's server-side admin `createUser` API in a separate CLI-only instance. The CLI does not mount admin routes in the app. Local account creation and login are verified; the remote D1 HTTP integration has mock and local integration coverage, but has not been run against a real remote database. If a command is interrupted, inspect for a partially created user before retrying.
- `/api/ai/text` uses OpenAI Responses with default model `gpt-6.1-terra`; `/api/audio/jobs` starts a Workflow calling Gemini model `gemini-3.8-flash-lite-tts`, stores WAV in R2, and tracks status in D1. Both model names are configurable via `OPENAI_MODEL`/`GEMINI_MODEL` at config evaluation. Availability is not verified; invalid/unavailable models fail rather than being silently replaced. No spending limits are implemented. Provider calls, retries and Cloudflare resources may incur charges.
- Audio retrieval checks ownership. The per-user Durable Object is an example counter, not a complete rate limiter. Workflow retries can duplicate provider charges; an R2 object key reduces duplicate writes but does not make external calls exactly once. Status is refreshed manually in the UI.
- The app has not been audited for deployment: complete CSRF, abuse protection, provider error handling, secure session settings, lifecycle/deletion and retention behavior, rate limiting, and integration/E2E coverage before use. Email verification/reset and OAuth are not configured. Avoid sensitive input until privacy and retention requirements are defined.
