# Agent instructions

- This repository is a reusable Pi package template. Keep the default package neutral and respect project instructions discovered by Pi.
- When asked to set up this package, tell the user before running `pnpm run setup` from the package root and report the outcome. The script installs dependencies and runs tests; use `--name` only if the user supplies a package name.
- Do not install this package into Pi settings, publish it, modify credentials, or change unrelated projects without explicit permission.
- Run relevant tests after changes and clearly report any unverified behavior.
