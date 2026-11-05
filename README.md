# my-pi-package

Pi package template.

```
AGENTS.md                      # package instructions (replace discovered AGENTS.md/CLAUDE.md)
extensions/index.ts            # extension entry (registers /hello)
extensions/agents-md.ts        # swaps context files for ./AGENTS.md
skills/example-skill/SKILL.md  # example skill
```

## Try it

```bash
pi -e .                 # load for one session without installing
pi install ./           # install as a local package (add -l for project scope)
```

Then run `/hello` or `/skill:example-skill` inside pi. Use `/reload` after edits.
