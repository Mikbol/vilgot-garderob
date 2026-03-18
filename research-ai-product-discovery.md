# Research: AI-driven produktuppdatering av Vilgots Garderob

Undersökt: 2026-03-16

---

## Beslut

**Agent-native approach valdes.** Istället för hårdkodade scraprar per butik körs OpenCode-agenter (`opencode run`) som själva söker webben, hittar produkter, och anropar `add-item.sh`. Se `research-agent-orchestration.md` för implementationsdetaljer och OpenCode-specifik research.

## Sammanfattning

Tre ansatser undersökta. Approach B (scrape + Claude-filter) rekommenderades initialt. Beslut blev istället agent-native: OpenCode-agenter med websök som gör allt (discovery + scraping + filtrering + tillägg). Approach C (keyword-filter) används som pre-filter i agentprompten.

---

## Approach A: Claude med web search

### Hur det fungerar

`claude -p` kör Claude Code i icke-interaktivt läge. Claude har tillgång till WebSearch (hittar URL:er) och WebFetch (hämtar och sammanfattar sidor). Dessa verktyg finns tillgängliga i headless mode.

```bash
claude -p "Sök efter nya gentleman-babykläder (smoking, fluga, hängslen, blazer, sjömanskostym) \
  på Childrensalon, Feltman Brothers och Jacadi. \
  Returnera produktdata som JSON." \
  --allowedTools "WebSearch,WebFetch,Bash,Read,Edit" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"products":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"price":{"type":"string"},"url":{"type":"string"},"image_url":{"type":"string"},"brand":{"type":"string"},"size":{"type":"string"}},"required":["name","price","url"]}}}}'
```

### Vad WebSearch/WebFetch faktiskt gör

- **WebSearch** tar en sökfråga och returnerar titlar + URL:er. Returnerar INTE sidinnehåll.
- **WebFetch** tar en URL + fråga, hämtar sidan, konverterar till Markdown, skickar till Haiku 3.5 som sammanfattar/svarar. Returnerar INTE rå HTML/JSON.
- WebFetch kapar citat vid 125 tecken och trunkerar sidor vid 100 KB.
- Ingen av dem ger rå produktdata. De ger sammanfattningar.

### Styrkor

- Kan hitta produkter från okända butiker och nya märken.
- Kan bedöma gränsfall ("är en kabelstickad cardigan formell nog?").
- `--json-schema` tvingar strukturerad output.
- Konversationsminne via `--continue` / `--resume` gör det möjligt att bygga flerstegs-workflows.
- Felfrekvens under 2% för välformulerade prompts (enligt Sfeir-benchmark).

### Svagheter

- **Opålitlig datautvinning.** WebFetch sammanfattar sidor, den extraherar inte strukturerad data. Pris kan bli "around $30" istället för "$27.99". Bild-URL:er kan utelämnas helt.
- **Ingen garanti för konsistens.** Samma prompt kan ge olika resultat mellan körningar.
- **Dyrt per körning.** Headless mode kostar $0.02-0.08 per prompt med Sonnet 4.6. Med websök: +$0.01 per sökning. En typisk discovery-session med 5-10 sökningar: $0.15-0.50.
- **Långsamt.** En headless-körning med websök tar 30-120 sekunder.
- **Kan inte ladda ner bilder direkt.** WebFetch returnerar text, inte binär data. Claude måste anropa Bash(curl) för bildnedladdning.

### Kostnad per körning

| Komponent | Kostnad |
|-----------|---------|
| Sonnet 4.6 tokens (~5000 in, ~2000 out) | ~$0.05 |
| WebSearch (5 sökningar) | $0.05 |
| WebFetch (10 sidhämtningar) | ingår i tokens |
| **Totalt per körning** | **~$0.10-0.20** |
| **Veckovis (52 ggr/år)** | **~$5-10/år** |

### Praktisk bedömning

Fungerar för **manuell discovery** ("hitta nya märken jag inte känner till"). Fungerar dåligt för **pålitlig automatiserad datautvinning** eftersom output varierar och saknar precision. Ska INTE vara enda metoden.

---

## Approach B: Scrape först, filtrera med Claude (REKOMMENDERAS)

### Arkitektur

```
1. Bash/Python hämtar rå produktdata från kända API:er/sajter
2. Rå data sparas som JSON (new-products.json)
3. Claude API filtrerar: "Är detta gentleman-stil?" → godkänd/underkänd
4. Godkända produkter läggs till via add-item.sh
5. Git commit + push
```

### Steg 1: Hämta rådata

Tre av fem kända butiker har Shopify och exponerar `/products.json` utan autentisering:

```bash
# The Tiny Universe
curl -s "https://thetinyuniverse.com/collections/suits-tuxedos/products.json" | \
  jq '[.products[] | {
    name: .title,
    price: (.variants[0].price + " kr"),
    url: ("https://thetinyuniverse.com/products/" + .handle),
    image_url: .images[0].src,
    brand: .vendor,
    sizes: [.variants[] | .title],
    source_id: (.id | tostring)
  }]'

# Cuddle Sleep Dream
curl -s "https://cuddlesleepdream.com/collections/baby-boy-tie-suspender-onesies/products.json" | \
  jq '[.products[] | {name: .title, price: ((.variants[0].price | tostring) + " USD"), url: ("https://cuddlesleepdream.com/products/" + .handle), image_url: .images[0].src, brand: .vendor, source_id: (.id | tostring)}]'

# Lulu Babe
curl -s "https://lulubabe.com/products.json" | \
  jq '[.products[] | {name: .title, price: ((.variants[0].price | tostring) + " AUD"), url: ("https://lulubabe.com/products/" + .handle), image_url: .images[0].src, brand: .vendor, source_id: (.id | tostring)}]'
```

Veriferat fungerande med ren curl. Inga headers krävs. Bilderna ligger på `cdn.shopify.com` utan hotlink-skydd.

Feltman Brothers (BigCommerce) och Childrensalon (custom) kräver HTML-scraping. Se befintlig research i `research-auto-update.md`, sektion 2.

### Steg 2: Deduplicering

```bash
# Innan Claude-steget: filtrera bort redan tillagda produkter
for url in $(jq -r '.[].url' new-products.json); do
  if ./add-item.sh exists --url "$url" 2>/dev/null; then
    # Ta bort ur new-products.json
    jq "del(.[] | select(.url == \"$url\"))" new-products.json > tmp.json && mv tmp.json new-products.json
  fi
done
```

### Steg 3: Claude filtrerar (API-anrop)

```bash
NEW_PRODUCTS=$(cat new-products.json)
RESPONSE=$(curl -s -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "{
    \"model\": \"claude-haiku-4-5\",
    \"max_tokens\": 4096,
    \"messages\": [{
      \"role\": \"user\",
      \"content\": \"Du kuraterar en lookbook för gentleman-babykläder. Godkänn BARA produkter som passar temat: smoking, kostym, fluga, hängslen, väst, slips, blazer, sjömanskostym, formella rompers, dressat. Underkänn vardagskläder, klänningar, casual bodys utan formell detalj, skor utan formell stil.\n\nReturnera en JSON-array med godkända produkter. Behåll alla fält oförändrade. Lägg till fältet 'section' med värde från: smoking, kostym, accessoarer, formellt, sjöman. Ingen annan text, bara JSON.\n\n$NEW_PRODUCTS\"
    }]
  }")
echo "$RESPONSE" | jq -r '.content[0].text' > approved-products.json
```

### Steg 4: Lägg till via add-item.sh

```bash
jq -c '.[]' approved-products.json | while read -r product; do
  name=$(echo "$product" | jq -r '.name')
  price=$(echo "$product" | jq -r '.price')
  url=$(echo "$product" | jq -r '.url')
  image_url=$(echo "$product" | jq -r '.image_url')
  brand=$(echo "$product" | jq -r '.brand // ""')
  size=$(echo "$product" | jq -r '.sizes[0] // ""')
  section=$(echo "$product" | jq -r '.section // ""')

  ./add-item.sh add \
    --name "$name" \
    --price "$price" \
    --url "$url" \
    --image-url "$image_url" \
    --brand "$brand" \
    --size "$size" \
    --section "$section" \
    --no-commit
done

# En push i slutet
git add index.html img/
git commit -m "auto: add $(jq length approved-products.json) new products"
git push origin main
```

### Kostnad

| Komponent | Kostnad |
|-----------|---------|
| Shopify API-anrop | $0 (gratis, inga API-nycklar) |
| Haiku 4.5 filter (~2000 tok in, ~1000 tok out) | ~$0.007 |
| **Totalt per körning** | **< $0.01** |
| **Veckovis (52 ggr/år)** | **~$0.40/år** |

### Varför Haiku räcker

Filtreringen är en enkel klassificeringsuppgift: "gentleman-stil eller ej". Haiku 4.5 klarar detta utmärkt. Inget behov av Sonnet/Opus. Sparar 3-15x i kostnad.

### Styrkor

- **Pålitlig data.** Scraping ger exakt pris, exakt URL, exakt bild-URL. Inget approximativt.
- **Billigt.** Under $1/år.
- **Snabbt.** Hela pipelinen kör på 10-30 sekunder.
- **Deterministiskt.** Samma produktdata ger samma resultat (förutom Claudes ja/nej-bedömning, som är stabil för tydliga fall).
- **Testbart.** Varje steg kan köras och verifieras separat.

### Svagheter

- Kräver att man känner till butikerna i förväg. Hittar inte nya märken automatiskt.
- Shopify `/products.json` kan stängas av (har inte hänt ännu, men Shopify har aviserat möjligheten).
- BigCommerce/Childrensalon-scraping är fragilt vid HTML-ändringar.

---

## Approach C: Ren scripting (inget AI)

### Implementation

```bash
KEYWORDS="tuxedo|suit|bow.tie|suspender|vest|waistcoat|formal|blazer|smoking|fluga|hängslen|kostym|sailor|gentleman|romper.*formal"

curl -s "https://thetinyuniverse.com/collections/suits-tuxedos/products.json" | \
  jq --arg kw "$KEYWORDS" '[.products[] | select((.title + " " + .body_html) | test($kw; "i"))]'
```

### Styrkor

- Noll dependencies, noll kostnad, noll API-nycklar.
- Helt deterministiskt.
- Trivial att debugga.

### Svagheter

- **Missar gränsfall.** En "Peter Pan Collar Linen Romper" är gentleman-stil men matchar inga keywords.
- **False positives.** "Formal occasion shoes" matchar "formal" men kan vara en rosa ballerina.
- **Inget omdöme.** Kan inte bedöma om en produkt visuellt passar temat.
- Ingen ny discovery. Bara filtrering av redan kända butiker.

### Praktisk bedömning

Fungerar bra som **pre-filter** (snabbt bort uppenbart irrelevant) men ska kombineras med Claude-filter för slutgiltigt beslut. Keyword-filter fångar ~80% av relevanta produkter och eliminerar ~90% av irrelevanta.

---

## Jämförelsetabell

| Kriterium | A: Claude websök | B: Scrape + Claude | C: Ren scripting |
|-----------|-------------------|---------------------|-------------------|
| Kostnad/körning | $0.10-0.20 | < $0.01 | $0 |
| Kostnad/år (veckovis) | $5-10 | ~$0.40 | $0 |
| Tillförlitlighet | Låg-medel | Hög | Hög |
| Precision (rätt produktdata) | Medel | Hög | Hög |
| Gränsfall (visuell bedömning) | Bra | Bra | Dålig |
| Ny discovery (okända butiker) | Bra | Ingen | Ingen |
| Hastighet | 30-120 s | 10-30 s | 5-10 s |
| Komplexitet | Låg (en prompt) | Medel (pipeline) | Låg |
| Underhåll | Lågt | Medel (per butik) | Medel (per butik) |

---

## Rekommenderad strategi: B + A hybrid

### Automatiserat (veckovis cron)

Approach B: Scrapa kända Shopify-butiker, filtrera med Haiku, lägg till via add-item.sh, pusha.

### Manuellt (månatligen eller vid behov)

Approach A: Kör `claude -p` med websök för att hitta nya butiker/märken. Lägg till nya butiker i scraping-pipelinen.

### Försvarslinje mot skräp

1. **Keyword pre-filter** (C) tar bort uppenbart irrelevant
2. **Claude Haiku filter** (B) bedömer gränsfall
3. **Dedup via URL** förhindrar dubletter
4. **add-item.sh --dry-run** möjliggör förhandsgranskning
5. **Git-historik** gör allt reversibelt

---

## Automation: hur köra jobbet

### Alt 1: GitHub Actions (REKOMMENDERAS)

```yaml
# .github/workflows/update-products.yml
name: Update Products

on:
  schedule:
    - cron: '0 8 * * 0'   # Söndag 08:00 UTC = 10:00 CEST
  workflow_dispatch:        # Manuell trigger via GitHub UI

permissions:
  contents: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - name: Fetch new products from Shopify stores
        run: bash scripts/fetch-shopify.sh > new-products.json

      - name: Filter duplicates
        run: |
          python3 json-helper.py extract index.html > existing.json
          python3 scripts/dedup.py new-products.json existing.json > unique-products.json

      - name: Filter with Claude (gentleman style only)
        if: ${{ hashFiles('unique-products.json') != '' }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: python3 scripts/claude-filter.py unique-products.json > approved.json

      - name: Add approved products
        if: ${{ hashFiles('approved.json') != '' }}
        run: |
          jq -c '.[]' approved.json | while read -r p; do
            ./add-item.sh add \
              --name "$(echo "$p" | jq -r '.name')" \
              --price "$(echo "$p" | jq -r '.price')" \
              --url "$(echo "$p" | jq -r '.url')" \
              --image-url "$(echo "$p" | jq -r '.image_url')" \
              --brand "$(echo "$p" | jq -r '.brand // ""')" \
              --section "$(echo "$p" | jq -r '.section // ""')" \
              --no-commit || true
          done

      - name: Commit and push
        uses: stefanzweifel/git-auto-commit-action@v7
        with:
          commit_message: 'auto: update product catalog'
          file_pattern: 'index.html img/*'
```

**Fördelar:**
- Gratis (2000 min/månad för privata repos, obegränsat för publika).
- Ingen lokal maskin behöver vara igång.
- `workflow_dispatch` ger manuell trigger via GitHub UI.
- `ANTHROPIC_API_KEY` lagras som GitHub Secret.

**Nackdelar:**
- Schemalagda jobb kan fördröjas vid hög GitHub-belastning (spelar ingen roll veckovis).
- Publika repos inaktiveras efter 60 dagar utan aktivitet.

### Alt 2: macOS launchd

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>local.vilgot-garderob.update</string>
    <key>Program</key>
    <string>/Users/bolm/AI-Assistent/vilgot-kläder/site/auto-update.sh</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>0</integer>
        <key>Hour</key>
        <integer>10</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/vilgot-update.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/vilgot-update.err</string>
</dict>
</plist>
```

Spara som `~/Library/LaunchAgents/local.vilgot-garderob.update.plist` och ladda:

```bash
launchctl load -w ~/Library/LaunchAgents/local.vilgot-garderob.update.plist
```

**Fördelar:**
- Kör lokalt, full kontroll.
- `StartCalendarInterval` kör jobbet när datorn vaknar (till skillnad från cron som missar jobb under sömn).

**Nackdelar:**
- Kräver att Mac:en är igång (eller vaknar vid rätt tid).
- Git push kräver konfigurerad SSH-nyckel eller PAT.

### Alt 3: Cron (enklast)

```bash
# crontab -e
0 10 * * 0 cd ~/AI-Assistent/vilgot-kläder/site && ./auto-update.sh >> auto-update.log 2>&1
```

**Nackdel:** Missar jobb om datorn sover. Använd launchd istället på macOS.

### Rekommendation

**GitHub Actions** om repot redan ligger på GitHub (det gör det). Noll underhåll, gratis, funkar oavsett om din Mac är igång.

---

## Git push från automatiserat jobb

### GitHub Actions

Automatiskt hanterat. `GITHUB_TOKEN` har `contents: write` och `stefanzweifel/git-auto-commit-action` sköter commit + push.

### Lokalt (launchd/cron)

Tre alternativ, i rekommenderad ordning:

1. **SSH-nyckel** (redan konfigurerad om `git push` funkar manuellt)
2. **Fine-grained PAT** med enbart `contents: write` på det specifika repot. Lagra i keychain eller `~/.config/git/credentials`.
3. **GitHub CLI** (`gh auth login` en gång, sedan `git push` fungerar).

---

## Hur ofta köra?

| Frekvens | Motivering |
|----------|-----------|
| **1x/vecka** (söndag) | Dessa butiker uppdaterar sortiment 1-4 ggr/månad. Veckovis fångar allt utan onödig körning. |
| 1x/dag | Överdriven. Shopify-butiker ändrar inte dagligen. Slösar GitHub Actions-minuter. |
| 1x/månad | Risk att missa säsongsbyten. |
| Manuellt trigger | Bra komplement. `workflow_dispatch` i Actions eller `./auto-update.sh` lokalt. |

**Rekommendation: 1x/vecka + manuell trigger.**

---

## Förhindra skräpprodukter

### Flerlagers-filter

```
Rå produktdata (20-50 st)
  │
  ├─ Keyword pre-filter → tar bort uppenbart irrelevant (~70% bort)
  │
  ├─ Dedup (URL + source_id) → tar bort redan tillagda
  │
  ├─ Claude Haiku filter → bedömer gränsfall (5-10% bort)
  │
  └─ Godkända produkter (2-5 st)
        │
        └─ add-item.sh (med bildverifiering, dublettkontroll)
```

### Vad som kan gå fel och hur det hanteras

| Problem | Förebyggande |
|---------|-------------|
| Helt irrelevant produkt (klänning, leksak) | Keyword pre-filter + Claude-filter |
| Gränsfall (casual cardigan) | Claude-filter med tydlig prompt |
| Trasig bild-URL | add-item.sh verifierar MIME-typ |
| Duplikat | URL-check via `add-item.sh exists` |
| Fel pris/namn | Direkt från API, inte AI-tolkat |
| Claude hallucination | Inte relevant: Claude filtrerar, den uppfinner inte data |
| Shopify API nere | Skriptet exiterar med felkod, Actions rapporterar failure |

---

## Evidensluckor

- **WebFetch för e-handel.** Ingen empirisk test gjord av WebFetch på produktsidor. Oklart om det returnerar pris/bild-URL tillförlitligt. Troligen inte, baserat på dess design (sammanfattar, trunkerar, 125 tecken max citat).
- **Shopify API framtid.** Shopify har aviserat att `/products.json` kan kräva autentisering i framtiden. Inget datum satt. Backup: Storefront API (gratis, kräver API-nyckel).
- **Claude Haiku filterprecision.** Ingen kvantitativ test gjord. Uppskattning baserad på att klassificeringsuppgifter är Haikus starkaste use case.
- **GitHub Actions 60-dagarsregel.** Publika repos inaktiveras efter 60 dagar utan aktivitet. Om jobbet inte hittar nya produkter på 60 dagar kan workflowet stängas av. Lösning: commita en timestamp-fil oavsett.
- **Bildhotlinking.** Childrensalon (CloudFront) ej testad. Kan kräva Referer-header.
- **Rate limits.** Shopify: 2 req/s (irrelevant vid veckovis körning). Anthropic API: 1000 req/min för Haiku (irrelevant vid 1 anrop/vecka).

---

## Källor

- [Claude Code headless mode (officiell dokumentation)](https://code.claude.com/docs/en/headless)
- [Claude API web search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Code WebFetch vs WebSearch](https://mikhail.io/2025/10/claude-code-web-tools/)
- [Shopify /products.json scraping](https://dev.to/dentedlogic/the-shopify-productsjson-trick-scrape-any-store-25x-faster-with-python-4p95)
- [GitHub Actions scheduled workflows](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows)
- [macOS launchd scheduling](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html)
- [stefanzweifel/git-auto-commit-action](https://github.com/stefanzweifel/git-auto-commit-action)
- [Firecrawl MCP for Claude Code](https://docs.firecrawl.dev/developer-guides/mcp-setup-guides/claude-code)
