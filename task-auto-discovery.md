# Task: Automatisk produktuppdatering (auto-discovery)

Skapad: 2026-03-16

## Status: KLAR

## Mål

Sajten https://mikbol.github.io/vilgot-garderob/ uppdateras automatiskt med nya gentleman-babykläder via AI-agenter. Daglig körning utan mänsklig inblandning.

## Flöde

### Research ✅
- `research-agent-orchestration.md` (headless, CLI-flaggor, kostnad, skript)
- `research-ai-product-discovery.md` (3 approaches, websök vs scrape+filter)
- `research-shopify-json-api.md` (endpoints, paginering, rate limits)
- `research-non-shopify-scraping.md` (7 sajter, anti-bot, Google Shopping)
- `research-json-lookbook-architecture.md` (add-item.sh, agent-integration)
- `research-site-redesign.md` (sektion 1: modellval, Zen free models)

### Beslut ✅
Dokumenterat i `plan-auto-discovery.md` (sektion "Beslut" och "Modellval"). Inget separat beslutsdokument (beslut togs innan dokumenttyper definierades).

### Plan ✅
- `plan-auto-discovery.md` (huvudplan, alla steg)
- `plan-fullkorning.md` (5-agent körning med timeout-fix)

### Exekvering ✅
- Härdad add-item.sh (validering, sections, mktemp-fix, mkdir-lås)
- opencode.json (permissions, nemotron-3-super-free)
- agents/product-scout.md (6-stegs arbetsflöde, USD-prisformat)
- orchestrate.sh (dg_timeout, 5 agenter, dry-run)
- test-auto-discovery.sh (27 tester)
- diagnose-run.sh (logganalys)
- launchd installerad (dagligen kl 05:45)

### Verifiering ✅
- 27/27 automatiska tester PASS
- Single agent: 3 produkter tillagda, Chrome-verifierat
- Full körning: 5 produkter tillagda, Chrome-verifierat (83/83 bilder, 0/80 felaktiga länkar)
- Live-sajt verifierad: WebFetch + Chrome fullVerify + curl

## Resultat

80 produkter med bilder. Auto-discovery kör dagligen kl 05:45 och pushar automatiskt.
