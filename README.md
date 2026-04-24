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

## Local development

The site is fully static — HTML, CSS, JS, and images, no backend, no
`fetch`, no build step. `PRODUCTS` is inlined as a JSON array in
`index.html`; GSAP and canvas-confetti are loaded from CDNs.

Open `index.html` directly:

```
open index.html
```

When editing CSS/JS, use DevTools → Network → "Disable cache" to skip
Chrome's cache without reloading query strings.

## Discovery pipeline

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

Load, unload, or inspect the scheduler:

```
launchctl load   ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist
launchctl unload ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist
launchctl list | grep vilgot-garderob
```

Run one agent locally against the production files:

```
./add-item.sh count                        # current product count
./add-item.sh sections                     # valid sections
./add-item.sh exists --url "https://..."   # dedupe check
./orchestrate.sh --single 0 --no-push      # one agent, no git push
```
