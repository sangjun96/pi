# Agent instructions

- This directory is a reusable template. Preserve feature boundaries and required integrations; keep example application code clearly optional and avoid project-specific branding.
- For local first-time setup, tell the user before running `pnpm run setup`, then report success or the failing step. It preserves existing `.dev.vars` and local D1 data. Do not read or print secret values.
- Do not create accounts on the user's behalf or ask them to disclose passwords in chat. Let the user run `pnpm account:create:local` or the remote variant in their own terminal.
- Never provision, migrate, or deploy remote resources without explicit user approval. Do not perform billable provider tests without approval.
- Run relevant tests and type checks after changes; clearly report unverified remote integrations.
