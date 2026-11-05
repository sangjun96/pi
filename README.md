# my-pi-package

Pi package template.

```
AGENTS.md                      # package instructions (replace discovered AGENTS.md/CLAUDE.md)
extensions/index.ts            # extension entry (registers /hello)
extensions/agents-md.ts        # swaps context files for ./AGENTS.md
extensions/mcp.ts              # registers MCP servers (Exa, OAuth)
extensions/permission-gate.ts  # asks before risky tool calls
skills/example-skill/SKILL.md  # example skill
```

## Try it

```bash
pi -e .                 # load for one session without installing
pi install ./           # install as a local package (add -l for project scope)
```

Then run `/hello` or `/skill:example-skill` inside pi. Use `/reload` after edits.

## MCP servers

`extensions/mcp.ts` registers the servers listed in `MCP_SERVERS`. Inside pi:

```
/mcp login exa   # opens the Exa sign-in page (OAuth); tokens go to ~/.pi/agent/mcp-auth.json
/mcp             # check status
```

To add a server, add an entry to `MCP_SERVERS` with the same shape as an `mcpServers` entry in
`mcp.json` (see pi's `docs/mcp.md`). Remote servers with no `Authorization` header use OAuth.
`pi mcp list` doesn't load extensions, so check these servers with `/mcp` instead.

## Permission gate

`extensions/permission-gate.ts` checks every tool call (including calls made from `codemode`) before it runs:

- **deny**: `rm -r` on `/` or home, `--no-preserve-root`
- **ask**: `rm -r`/`-f`, `sudo`, `git push --force`, `git reset --hard`, `git clean -f`, `curl | sh`,
  package publish/removal, migrations, destructive SQL, deploy/infra commands; writes to `.env*`
  (not `.env.example`), `.git/`, `.ssh/`, credentials, or outside the working directory; starting an
  Exa `agent_run` (paid); other MCP and extension tools unless their annotations say read-only
  (or neither destructive nor open-world)
- **allow**: everything else, including Exa `web_search_exa`, `web_fetch_exa`, and resuming an
  approved `agent_run` by `runId`

The prompt offers *Allow*, *Allow for this session* (same tool + rule), or *Reject*. Without a UI
(`-p`, JSON mode) asked calls are blocked. Rules are regexes on the command text: they catch mistakes
but are easy to bypass and can over-match words inside quoted strings, so run pi in a sandbox
when you need a real boundary (pi's `docs/security.md`). Edit the lists at the top of the file to
change the rules, and `pnpm test` to check them.
