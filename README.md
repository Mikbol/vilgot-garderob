# Vilgots Garderob

Static lookbook site with an automated product-discovery pipeline for gentleman-style baby clothes.

## What's here

### Site (served as GitHub Pages)
- `index.html` — the lookbook
- `style.css`, `app.js` — styles and client code
- `img/` — product images

### Discovery pipeline
- `orchestrate.sh` — runs 5 `opencode` agents sequentially, commits and pushes new products
- `agents/product-scout.md` — agent prompt (search → verify → dedupe → add)
- `add-item.sh` — CLI used by agents to add/query products in `index.html`
- `json-helper.py` — helper invoked by `add-item.sh`
- `opencode.json` — opencode config
- `logs/` — per-agent run logs (gitignored)

## Running

Manual:
```
./orchestrate.sh                 # run all 5 agents, commit + push
./orchestrate.sh --dry-run       # preview
./orchestrate.sh --single 0      # one agent
./orchestrate.sh --no-push       # commit locally only
```

Scheduled: `launchd` job `local.vilgot-garderob.discovery` runs `orchestrate.sh` daily at 05:45.
Plist lives at `~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist`.
stdout/stderr: `/tmp/vilgot-discovery.{log,err}`.
