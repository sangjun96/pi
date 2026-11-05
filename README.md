# my-pi-package

Pi package template.

```
AGENTS.md                      # package instructions (replace discovered AGENTS.md/CLAUDE.md)
extensions/index.ts            # extension entry (registers /hello)
extensions/agents-md.ts        # swaps context files for ./AGENTS.md
extensions/mcp.ts              # registers MCP servers (Exa, OAuth)
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
