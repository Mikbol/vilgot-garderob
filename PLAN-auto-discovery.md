# Plan: Automatisk produktuppdatering med AI-agenter

Beslutad: 2026-03-16
Uppdaterad: 2026-03-17 (steg 1-5 implementerade, modellval avgjort)

## Mål

Sajten https://mikbol.github.io/vilgot-garderob/ uppdateras automatiskt med nya gentleman-babykläder. OpenCode-agenter söker webben, hittar produkter, och anropar `add-item.sh`. Ett cron-jobb kör agenterna och pushar till GitHub.

## Beslut

- **Engine:** OpenCode (primär och enda). Claude Code är inte ett alternativ.
- **Modell:** Gratis via OpenCode Zen. Se modellval-research nedan.
- **Valutor:** Alla accepteras (3-bokstavs ISO-koder + symboler).
- **Notiser:** Inte prioriterat. Kan läggas till senare vid behov.
- **Sandbox:** OpenCode i Docker-container undersöks separat (se `opencode/research/docker-sandbox.md`).

## Modellval (research 2026-03-17)

Fyra alternativ utvärderade:

| Alternativ | Kostnad | Websearch | Kvalitet | Begränsning |
|---|---|---|---|---|
| **OpenCode Zen (gratis modeller)** | **$0** | **Ja (Exa, gratis)** | **Medel-hög** | **Kräver Zen-konto. Gratis modeller kan försvinna.** |
| GitHub Copilot Free | $0 | Ja (via OpenCode) | Hög | 50 requests/mån (för lite) |
| GitHub Copilot Pro | $10/mån | Ja (via OpenCode) | Hög (Sonnet 4.6) | 300 premium requests/mån |
| Ollama (lokalt) | $0 | Nej | Låg-medel | Ingen websearch, svagare modeller |

### Valt: OpenCode Zen med gratis modell

OpenCode har en egen modell-gateway (Zen) med gratis modeller. Dessa är tillfälligt gratis (modell-leverantörer samlar användningsdata) men fungerar fullt ut.

Tillgängliga gratis Zen-modeller (mars 2026):
- GPT 5 Nano (lättvikt)
- Big Pickle
- MiMo V2 Flash Free
- Nemotron 3 Super Free
- MiniMax M2.5 Free

Websearch fungerar via Exa AI (inbyggt i OpenCode, kräver ingen API-nyckel). Aktiveras med `OPENCODE_ENABLE_EXA=1` eller automatiskt vid Zen-anslutning.

**Setup:**
1. Kör `opencode` interaktivt
2. Kör `/connect`, välj "OpenCode Zen"
3. Skapa konto (gratis)
4. Välj en av de gratis modellerna
5. Modellen sparas och återanvänds av orchestrate.sh

**Modell anges inte i opencode.json** (bestäms av vad som konfigureras via `/connect`). Om en specifik modell ska låsas, lägg till `"model": "zen/MODELLNAMN"` i opencode.json.

### Alternativ

**GitHub Copilot** ($10/mån): Bättre modellkvalitet (Sonnet 4.6) men kostar. Setup: `/connect` > "GitHub Copilot" > device login. Ändra `"model"` i opencode.json till `"github-copilot/claude-sonnet-4-6"`.

**Ollama** ($0, helt lokalt): Ingen websearch, ingen molntjänst. Agenten kan bara använda webfetch med kända URL:er. Setup: installera Ollama, ladda ned modell, ändra `"model"` i opencode.json till `"ollama/qwen2.5-coder:32b"`.

### Risker med gratis Zen-modeller

- Kan försvinna utan förvarning (leverantören slutar erbjuda dem gratis)
- Kvaliteten varierar; kan vara för svag för att följa agent-prompten korrekt
- Om alla gratis modeller försvinner: byt till Copilot eller Ollama

Om testningen (steg 7) visar att den valda Zen-modellen inte klarar uppgiften (hittar inga produkter, hallucerar, misslyckas med add-item.sh), testa en annan Zen-modell eller byt till Copilot.

## Säkerhetsmodell

Agenten ska INTE behöva "göra rätt". Systemet tvingar rätt beteende genom tre lager:

1. **Permissions** begränsar vilka kommandon agenten kan köra
2. **Skriptet** validerar all indata och avvisar felaktigt format
3. **Prompten** instruerar agenten vad den ska göra

Om agenten hallucerar, skickar skräp, eller försöker köra oväntade kommandon, fångas det av lager 1 eller 2 innan något skrivs till `index.html`. Mänsklig inblandning ska inte behövas.

## Redan klart

- [x] `index.html` med `const PRODUCTS = [...]` (68 produkter, JSON-driven rendering)
- [x] `add-item.sh` (add, list, count, exists, remove, sections, flock-lås, bildverifiering via magic bytes, dedup, strikt validering)
- [x] `json-helper.py` (raw_decode, atomic writes)
- [x] Research: agent-orkestrering, OpenCode, Shopify API, scraping, AI-discovery
- [x] `opencode.json` (permissions, modell, agent-definition)
- [x] `agents/product-scout.md` (6-stegs arbetsflöde, regler)
- [x] `orchestrate.sh` (5 agenter, dry-run, single, timeout, roterande sökfokus)
- [x] `.gitignore` (logs/, .add-item.lock, *.tmp, index.html.bak)
- [x] Härdning av add-item.sh: URL, pris, sektion, storlek, namn, brand, bild-URL (8/8 tester OK)
- [x] Modellval: research och beslut (OpenCode Zen gratis modell, Copilot/Ollama som fallback)
- [x] Testskript: `test-auto-discovery.sh` (validering + OpenCode + pipeline)
- [x] Diagnostik: `diagnose-run.sh` (logganalys: websearch, fel, mktemp, dollar-pris, permissions)
- [x] Timeout: `dg_timeout` som primär, `timeout` som fallback (Linux/sandbox)
- [x] mktemp-fix: 8 X:ar istället för 6, inget .json-suffix

## Filer

```
vilgot-kläder/site/
├── add-item.sh               # KLAR: strikt validering, sections-kommando
├── opencode.json              # KLAR: permissions, modell, agent
├── agents/
│   └── product-scout.md       # KLAR: agent-definition
├── orchestrate.sh             # KLAR: huvudskript (dry-run testad, dg_timeout)
├── diagnose-run.sh            # KLAR: logganalys efter körning
├── logs/                      # KLAR: gitignored
└── .gitignore                 # KLAR
```

---

## Steg 1: Härdning av add-item.sh ✅ (implementerad 2026-03-17, 8/8 tester OK)

Alla valideringar sker i skriptet. Agenten kan inte kringgå dem.

### 1.1 URL-validering

Lägg till i `cmd_add()` efter befintliga required-checks:

```bash
# URL must be HTTPS
[[ "$url" =~ ^https:// ]] || die "URL must start with https://"

# Block search engine URLs (agent should use the actual product page)
[[ "$url" =~ (google\.com|bing\.com|duckduckgo\.com|yahoo\.com|search\.) ]] && \
    die "URL is a search engine URL, not a product page"

# Block too-short URLs (likely incomplete)
[[ ${#url} -ge 20 ]] || die "URL too short (min 20 chars)"
```

### 1.2 Prisformat-validering

```bash
# Price must contain at least one digit and a currency indicator.
# Accepts any format: "490 kr", "$27.99", "£78", "AUD 29.96", "DKK 199", "€45", "1 299 SEK"
# Rejects: "around thirty dollars", "free", "cheap", empty strings
[[ "$price" =~ [0-9] ]] || die "Price must contain at least one digit: '$price'"
[[ "$price" =~ (kr|KR|SEK|DKK|NOK|USD|GBP|EUR|AUD|CAD|JPY|CHF|[\$£€¥]) ]] || \
    die "Price must contain a currency (kr, \$, £, €, or ISO code): '$price'"
[[ ${#price} -le 30 ]] || die "Price too long (max 30 chars): '$price'"
```

### 1.3 Sektions-whitelist

Sektionslistan definieras EN gång i skriptet. Agenten kan inte hitta på nya sektioner.

```bash
VALID_SECTIONS=(
    "The Tiny Universe"
    "Lulu Babe"
    "Custom & Handgjort"
    "Cuddle Sleep Dream"
    "H&M"
    "Jacadi Paris"
    "Accessoarer"
    "Sailor & Nautisk Stil"
    "Stickade Set"
    "Dressade Rompers"
    "Childrensalon: Formal"
    "Childrensalon: Blazers & Hängslen"
    "Childrensalon: Skor & Accessoarer"
    "Lilax: Tuxedo Footies"
    "Childrensalon: Buster Suits"
)

if [ -n "$section" ]; then
    local valid=false
    for s in "${VALID_SECTIONS[@]}"; do
        [[ "$s" == "$section" ]] && valid=true && break
    done
    [ "$valid" = true ] || die "Invalid section: '$section'. Run './add-item.sh sections' to list valid sections."
fi
```

Lägg också till ett nytt kommando `sections` som listar giltiga sektioner:

```bash
cmd_sections() {
    for s in "${VALID_SECTIONS[@]}"; do
        echo "$s"
    done
}
```

Agenten kan köra `./add-item.sh sections` för att se listan.

### 1.4 Storleksformat-validering

```bash
# Size must follow pattern "Från XX" where XX is a size (number, NB, or NM pattern)
if [ -n "$size" ]; then
    [[ "$size" =~ ^Från\ [0-9A-Z] ]] || \
        die "Invalid size format: '$size'. Expected 'Från 62', 'Från NB', 'Från 3M', etc."
fi
```

### 1.5 Namn- och brand-validering

```bash
# Name: required, 3-120 chars
[[ ${#name} -ge 3 ]] || die "Name too short (min 3 chars)"
[[ ${#name} -le 120 ]] || die "Name too long (max 120 chars)"

# Brand: required (not optional anymore)
[ -n "$brand" ] || die "Missing --brand (required)"
[[ ${#brand} -ge 2 ]] || die "Brand too short (min 2 chars)"
[[ ${#brand} -le 60 ]] || die "Brand too long (max 60 chars)"
```

### 1.6 Bild-URL-validering (före nedladdning)

Befintlig `download_image()` validerar redan HTTP-status och magic bytes. Lägg till URL-kontroll innan curl körs:

```bash
# Image URL must be HTTPS and look like an image URL or CDN
[[ "$image_url" =~ ^https:// ]] || die "Image URL must start with https://"

# Block obviously wrong image URLs
[[ "$image_url" =~ (google\.com/search|bing\.com/images) ]] && \
    die "Image URL is a search page, not a direct image link"
```

### 1.7 Blockera remove för agenter

`remove` ska bara kunna köras manuellt, inte av agenter. Permissions-lagret (steg 2) hanterar detta genom att bara tillåta `add`, `exists`, `count`, `list`, `sections`.

### 1.8 Verifiering av steg 1

Kör dessa tester efter implementering. Alla ska ge felmeddelande och exit 1:

```bash
# Felaktig URL
./add-item.sh add --name "Test" --price "100 kr" --url "http://example.com" --image-url "https://x.com/img.jpg" --brand "Test" --no-commit
# → ERROR: URL must start with https://

# Sök-URL
./add-item.sh add --name "Test" --price "100 kr" --url "https://google.com/search?q=baby" --image-url "https://x.com/img.jpg" --brand "Test" --no-commit
# → ERROR: URL is a search engine URL

# Felaktigt pris
./add-item.sh add --name "Test" --price "around 30 dollars" --url "https://example.com/product" --image-url "https://x.com/img.jpg" --brand "Test" --no-commit
# → ERROR: Invalid price format

# Ogiltig sektion
./add-item.sh add --name "Test Product" --price "100 kr" --url "https://example.com/product" --image-url "https://x.com/img.jpg" --brand "Test" --section "Min Påhittade Sektion" --no-commit
# → ERROR: Invalid section

# Felaktigt storleksformat
./add-item.sh add --name "Test Product" --price "100 kr" --url "https://example.com/product" --image-url "https://x.com/img.jpg" --brand "Test" --size "62" --no-commit
# → ERROR: Invalid size format (should be "Från 62")

# Saknar brand
./add-item.sh add --name "Test Product" --price "100 kr" --url "https://example.com/product" --image-url "https://x.com/img.jpg" --no-commit
# → ERROR: Missing --brand

# Lista sektioner
./add-item.sh sections
# → alla giltiga sektionsnamn, ett per rad
```

---

## Steg 2: OpenCode projektkonfig ✅

**Fil:** `opencode.json` (implementerad 2026-03-17)

```json
{
  "model": "github-copilot/claude-sonnet-4-6",
  "permission": {
    "bash": {
      "*": "deny",
      "./add-item.sh add *": "allow",
      "./add-item.sh exists *": "allow",
      "./add-item.sh count": "allow",
      "./add-item.sh list *": "allow",
      "./add-item.sh sections": "allow"
    },
    "read": { "*": "deny" },
    "write": { "*": "deny" },
    "edit": { "*": "deny" },
    "websearch": { "*": "allow" },
    "webfetch": { "*": "allow" }
  },
  "agent": {
    "product-scout": {
      "definition": "./agents/product-scout.md",
      "steps": 20
    }
  }
}
```

### Vad agenten KAN göra

- Söka webben (websearch, webfetch)
- Lägga till produkter (`./add-item.sh add ...`)
- Kolla duplikat (`./add-item.sh exists ...`)
- Räkna produkter (`./add-item.sh count`)
- Lista produkter (`./add-item.sh list`)
- Lista giltiga sektioner (`./add-item.sh sections`)

### Vad agenten INTE kan göra

- Ta bort produkter (remove blockerat)
- Läsa godtyckliga filer (read deny)
- Skriva/redigera filer direkt (write/edit deny)
- Köra andra bash-kommandon (cat, git, curl, rm, etc.)
- Ändra index.html direkt (bara via add-item.sh som validerar)

**Verifiering:** `cat opencode.json | python3 -m json.tool` (valid JSON)

---

## Steg 3: Agent-definition ✅ (implementerad 2026-03-17)

**Fil:** `agents/product-scout.md`

```markdown
# Product Scout

Du söker efter gentleman-babykläder och lägger till dem i Vilgots Garderob lookbook.

## Ditt sökfokus

Du får ett sökfokus som argument. Sök BARA inom det området.

## Arbetsflöde

Följ dessa steg exakt, i ordning. Hoppa inte över steg.

### Steg 1: Sök
Använd websearch med 2-3 olika söktermer relaterade till ditt fokus. Sök på engelska. Variera termerna för att hitta olika resultat.

### Steg 2: Verifiera
För varje lovande träff från sökningen, använd webfetch för att öppna produktsidan. Extrahera exakt:
- **Produktnamn** (som det står på sidan, 3-120 tecken)
- **Pris** (exakt, med valuta, t.ex. "490 kr", "$27.99", "£78")
- **Produktsidans URL** (HTTPS, den faktiska produkt-URL:en, inte en sök-URL)
- **Bild-URL** (HTTPS, direkt länk till en produktbild)
- **Märke/brand** (obligatoriskt)
- **Storlek** (minsta tillgängliga storlek, format: "Från 62", "Från NB", "Från 3M")

Om du INTE kan hämta exakt pris eller bild-URL via webfetch, HOPPA ÖVER produkten.

### Steg 3: Kolla duplikat
Kör detta INNAN du lägger till:
```
./add-item.sh exists --url "PRODUKTENS_URL"
```
Om svaret innehåller `"exists": true`, hoppa över produkten.

### Steg 4: Hitta rätt sektion
Kör:
```
./add-item.sh sections
```
Välj den sektion som bäst matchar produkten. Använd EXAKT det namn som listas.

### Steg 5: Lägg till
Kör:
```
./add-item.sh add \
  --name "PRODUKTNAMN" \
  --price "PRIS" \
  --url "PRODUKTSIDANS_URL" \
  --image-url "BILD_URL" \
  --brand "MÄRKE" \
  --size "Från XX" \
  --section "SEKTIONSNAMN" \
  --no-commit
```

Alla parametrar utom --section och --size är obligatoriska. Skriptet validerar formaten och avvisar felaktig data.

### Steg 6: Bekräfta
Verifiera att add-item.sh returnerade `"status": "added"`. Om den returnerade ett fel (ERROR), läs felmeddelandet. Det talar om exakt vad som var fel. Försök INTE igen med samma data. Gå vidare till nästa produkt.

## Regler

1. **Max 3 produkter per körning.** Bättre 1 verifierad än 3 osäkra.
2. **BARA gentleman-stil:** smoking, kostym, fluga, hängslen, väst, slips, blazer, sjömanskostym, formella rompers, dopkläder, stickade formella set.
3. **ALDRIG:** vardagskläder, klänningar, casual bodys utan formell detalj, skor utan formell stil, leksaker.
4. **ALDRIG hallucera.** Om du inte kan verifiera en produkt via webfetch, hoppa över den.
5. **Kopiera pris EXAKT** som det står på sidan. Skriv inte "around $30", skriv "$29.99".
6. **Bild-URL måste vara HTTPS** och en direkt länk till en bildfil. Inte en sidsökväg.
7. Om add-item.sh returnerar "already exists", gå vidare tyst.
```

### Skillnader mot tidigare version

- Steg 4 (sections) tillagt: agenten frågar skriptet vilka sektioner som finns istället för att ha en hårdkodad lista i prompten. Sektionslistan finns på EN plats (add-item.sh).
- Formatregler förtydligade: storlek ska vara "Från XX", pris ska vara exakt, brand är obligatoriskt.
- Steg 6 uppdaterat: agenten ska läsa felmeddelandet och inte försöka igen med samma data.

---

## Steg 4: Orkestreringsscript ✅ (implementerad 2026-03-17, dry-run OK)

**Fil:** `orchestrate.sh`

```bash
#!/bin/bash
# orchestrate.sh - Kör OpenCode-agenter för produktsökning och pusha resultatet
#
# Användning:
#   ./orchestrate.sh                    # Kör alla agenter
#   ./orchestrate.sh --dry-run          # Visa utan att köra
#   ./orchestrate.sh --single 0         # Kör bara agent 0
#   ./orchestrate.sh --model MODEL      # Använd annan modell
#   ./orchestrate.sh --no-push          # Kör men pusha inte

set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SITE_DIR/logs"
DATE=$(date '+%Y-%m-%d_%H%M%S')

# Konfigurerbart
MODEL=""  # Tom = använd default från opencode.json
TIMEOUT_SECS=180               # 3 min max per agent
DRY_RUN=false
NO_PUSH=false
SINGLE_AGENT=""

# Sökfokus per agent (5 agenter)
AGENT_FOCUSES=(
  "baby tuxedo suit formal outfit gentleman infant newborn"
  "baby bow tie suspender romper gentleman outfit bodysuit"
  "baby sailor suit nautical outfit infant formal marine knit"
  "baby blazer vest waistcoat formal infant christening baptism"
  "baby buster suit ceremony romper formal European designer"
)

# Roterande tillägg baserat på veckonummer (variation över tid)
WEEK_NUM=$(( $(date +%V) % 4 ))
WEEKLY_EXTRAS=(
  "new arrivals spring 2026"
  "Childrensalon Jacadi Feltman Brothers"
  "Scandinavian Swedish baby formal"
  "luxury designer baby gentleman premium"
)
WEEKLY_EXTRA="${WEEKLY_EXTRAS[$WEEK_NUM]}"

# Parse flaggor
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --no-push) NO_PUSH=true; shift ;;
    --single) SINGLE_AGENT="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --timeout) TIMEOUT_SECS="$2"; shift 2 ;;
    *) echo "Okänd flagga: $1" >&2; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"

# Kontrollera att opencode finns
command -v opencode >/dev/null 2>&1 || { echo "opencode not found in PATH" >&2; exit 1; }

# Kontrollera att add-item.sh finns och fungerar
[ -x "$SITE_DIR/add-item.sh" ] || { echo "add-item.sh not found or not executable" >&2; exit 1; }

# Läs agent-prompten
AGENT_PROMPT=$(cat "$SITE_DIR/agents/product-scout.md")

# Bygg modell-flagga
MODEL_FLAG=""
[ -n "$MODEL" ] && MODEL_FLAG="--model $MODEL"

# Funktion: kör en agent
run_agent() {
  local idx="$1"
  local focus="${AGENT_FOCUSES[$idx]}"
  local full_focus="$focus $WEEKLY_EXTRA"
  local log_file="$LOG_DIR/${DATE}_agent-${idx}.log"

  echo "[$(date '+%H:%M:%S')] Agent $idx starting: $focus" | tee -a "$log_file"

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] Would search for: $full_focus" | tee -a "$log_file"
    return 0
  fi

  local prompt="$AGENT_PROMPT

---

Ditt sökfokus för denna körning: $full_focus"

  local start_time=$(date +%s)
  local exit_code=0

  timeout "$TIMEOUT_SECS" opencode run "$prompt" \
    $MODEL_FLAG \
    -q \
    >> "$log_file" 2>&1 || exit_code=$?

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  if [ "$exit_code" -eq 124 ]; then
    echo "[$(date '+%H:%M:%S')] Agent $idx TIMEOUT after ${TIMEOUT_SECS}s" | tee -a "$log_file"
  elif [ "$exit_code" -ne 0 ]; then
    echo "[$(date '+%H:%M:%S')] Agent $idx FAILED (exit $exit_code) after ${duration}s" | tee -a "$log_file"
  else
    echo "[$(date '+%H:%M:%S')] Agent $idx OK after ${duration}s" | tee -a "$log_file"
  fi

  return $exit_code
}

# === MAIN ===

cd "$SITE_DIR"

# Produkter före
BEFORE=$(./add-item.sh count 2>/dev/null || echo "0")

echo "=== Product Discovery $(date) ==="
echo "Model: ${MODEL:-default} | Timeout: ${TIMEOUT_SECS}s"
echo "Products before: $BEFORE"
echo "Weekly extra: $WEEKLY_EXTRA"
echo ""

# Bestäm vilka agenter som körs
if [ -n "$SINGLE_AGENT" ]; then
  INDICES=("$SINGLE_AGENT")
else
  INDICES=($(seq 0 $((${#AGENT_FOCUSES[@]} - 1))))
fi

# Kör agenter sekventiellt (undviker OpenCode sessionsinterferens #4251)
FAILURES=0
for idx in "${INDICES[@]}"; do
  run_agent "$idx" || FAILURES=$((FAILURES + 1))
done

# Produkter efter
AFTER=$(./add-item.sh count 2>/dev/null || echo "0")
NEW=$((AFTER - BEFORE))

echo ""
echo "Products after: $AFTER (+$NEW new)"

# Git commit + push
if [ "$NEW" -gt 0 ] && [ "$DRY_RUN" = false ]; then
  git add index.html img/
  git commit -m "auto: +$NEW gentleman baby clothes

Model: ${MODEL:-default}
Agents: ${#INDICES[@]}, Failures: $FAILURES"

  if [ "$NO_PUSH" = false ]; then
    git push origin main
    echo "Pushed to GitHub. Site updates in 1-2 min."
  else
    echo "Committed locally (--no-push). Run 'git push' manually."
  fi
elif [ "$NEW" -eq 0 ]; then
  echo "No new products. Nothing to commit."
fi

# Sammanfattning
echo ""
echo "=== Done ==="
echo "New products: $NEW"
echo "Failures: $FAILURES"
echo "Logs: $LOG_DIR/${DATE}_agent-*"
```

---

## Steg 5: .gitignore ✅ (implementerad 2026-03-17)

**Fil:** `.gitignore`

```
logs/
.add-item.lock
*.tmp
index.html.bak
```

---

## Steg 6: Schemaläggning

### Vad är launchd?

launchd är macOS inbyggda schemaläggare (motsvarar cron på Linux, men bättre integrerad). Apple har ersatt cron med launchd sedan macOS 10.4.

**Så fungerar det:**
- En XML-fil (plist) beskriver VAD som ska köras och NÄR
- Filen placeras i `~/Library/LaunchAgents/` (per-användare) eller `/Library/LaunchDaemons/` (systemvid)
- `launchctl` är kommandot för att ladda, avladda och inspektera jobb
- macOS läser plisten vid inloggning och kör jobbet enligt schema
- Om datorn sov vid schemalagd tid körs jobbet vid nästa uppvakning

**Skillnad mot cron:** launchd hanterar beroenden, kan starta jobb vid filändringar (inte bara tid), loggar stdout/stderr automatiskt, och återstartar crashade processer.

### Plist-fil

**Fil:** `~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>local.vilgot-garderob.discovery</string>
    <key>Program</key>
    <string>/Users/bolm/AI-Assistent/vilgot-kläder/site/orchestrate.sh</string>
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
    <string>/tmp/vilgot-discovery.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/vilgot-discovery.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
        <key>OPENCODE_ENABLE_EXA</key>
        <string>true</string>
    </dict>
</dict>
</plist>
```

### Förutsättningar

- **OpenCode Zen:** Måste vara konfigurerad innan launchd-jobbet fungerar. Kör `opencode` interaktivt, sedan `/connect` > "OpenCode Zen" > skapa konto > välj gratis modell. Autentiseringen sparas i `~/.config/opencode/` och återanvänds.
- **PATH:** Måste inkludera katalogen där `opencode` är installerad. Kör `which opencode` för att kontrollera.
- **Ingen API-nyckel behövs** i plisten (Zen autentiserar via sparad session).

### Installation

```bash
cp vilgot-garderob.discovery.plist ~/Library/LaunchAgents/
launchctl load -w ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist
launchctl list | grep vilgot  # verifiera: ska visa PID eller status
```

### Daglig användning och underhåll

```bash
# Se om jobbet är laddat och senaste status
launchctl list | grep vilgot
# Kolumn 1: PID (- = inte igång), Kolumn 2: senaste exit code (0 = OK), Kolumn 3: label

# Kör jobbet manuellt (utan att vänta på schema)
launchctl start local.vilgot-garderob.discovery

# Se loggar från senaste körning
cat /tmp/vilgot-discovery.log
cat /tmp/vilgot-discovery.err

# Stoppa/avladda jobbet tillfälligt
launchctl unload ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist

# Ladda igen
launchctl load -w ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist
```

### Ändra schema

Redigera `StartCalendarInterval` i plisten. Exempel:

```xml
<!-- Varje söndag kl 10:00 (nuvarande) -->
<key>Weekday</key><integer>0</integer>
<key>Hour</key><integer>10</integer>

<!-- Varje dag kl 08:00 -->
<!-- Ta bort Weekday-raden, behåll bara Hour + Minute -->

<!-- Varannan vecka: finns inte i launchd, lös via orchestrate.sh (kolla veckonummer) -->
```

Efter ändring: `launchctl unload` + `launchctl load -w` för att plisten läses om.

### Avinstallation

```bash
launchctl unload ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist
rm ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist
```

### Felsökning

| Problem | Kommando | Lösning |
|---|---|---|
| Jobbet körs inte | `launchctl list \| grep vilgot` | Om det inte syns: `launchctl load -w ...` |
| Exit code ≠ 0 | `cat /tmp/vilgot-discovery.err` | Läs felet, fixa, kör `launchctl start ...` |
| opencode not found | `cat /tmp/vilgot-discovery.err` | Uppdatera PATH i plisten |
| Zen-session utgången | Kör `opencode` interaktivt, `/connect` | Autentisera på nytt |

### Vad Claude/agenten behöver veta

Claude behöver normalt inte röra launchd. Undantag:
- Om Mikael ber om schemaändring: redigera plisten, unload + load
- Om Mikael rapporterar att auto-discovery slutat fungera: kolla `launchctl list`, loggar, och Zen-session
- Om orchestrate.sh byter sökväg: uppdatera `Program`-raden i plisten

---

## Steg 7: Validering (vad Claude ska köra)

Claude ska följa ALLA steg i denna sektion vid varje end-to-end-körning. Inga genvägar. Varje steg har tydliga pass/fail-kriterier. Om ett steg failar: stopp, felsök, fixa, kör om.

### 7.1 Automatiska tester

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site
./test-auto-discovery.sh
```

**Pass:** Alla tester PASS (SKIP för launchd OK innan steg 6).
**Fail:** Minst ett test FAIL. Fixa felet, kör igen. Gå INTE vidare.

### 7.2 Skarpt agenttest (utan push)

```bash
BEFORE=$(./add-item.sh count)
./orchestrate.sh --single 0 --no-push
AFTER=$(./add-item.sh count)
echo "Före: $BEFORE, Efter: $AFTER, Nya: $((AFTER - BEFORE))"
```

**Kör diagnos direkt efter:**

```bash
./diagnose-run.sh
```

Skriptet analyserar alla agentloggar och rapporterar: websearch-anrop, webfetch-besök, duplikat, tillagda, fel, mktemp-kollisioner, dollar-pris-buggar, permission denied, föräldralösa bilder. Claude ska köra detta efter VARJE orchestrate-körning.

**Pass (alla dessa ska vara sanna):**
- Agenten använde websearch (diagnosen visar ≥1 sökning)
- Agenten öppnade minst en produktsida via webfetch (≥1 sidbesök)
- Exit code 0 (ingen krasch, inget timeout)
- 0 mktemp-kollisioner
- 0 dollar-pris-buggar
- Om produkter lades till: `./add-item.sh count` är högre än innan

**Acceptabelt:** 0 nya produkter OM diagnosen visar att agenten sökte och alla hittade produkter redan fanns (duplikat) eller bildnedladdning blockerades (HTTP 403).

**Fail:**
- Agenten kraschade (exit ≠ 0)
- Agenten sökte inte alls (0 websearch i diagnosen)
- mktemp-kollisioner (temp-filer blockerar)
- Dollar-pris-buggar (agenten använder dubbla citattecken för $-priser)
- Timeout utan att ha hittat något

### 7.3 Pusha och verifiera live-sajt

**Detta steg är OBLIGATORISKT. Lokal rendering räcker INTE. Sajten måste verifieras LIVE på GitHub Pages.**

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site
git push origin main
```

Vänta tills GitHub Pages har byggt:

```bash
# Kolla deployment-status (ska vara "built")
gh api repos/Mikbol/vilgot-garderob/pages --jq '.status'
```

Om status inte är "built", vänta 30 sekunder och kör igen. Max 5 försök.

**Verifiera live-sajten (två metoder, kör BÅDA):**

**Metod 1: WebFetch (dataverifiering)**

Använd WebFetch mot `https://mikbol.github.io/vilgot-garderob/` med prompt:

> Count all products. List the last 5 products (highest ID numbers) with exact name and price. Check if all product cards have image references. List all section headings. Report any JavaScript errors or broken HTML.

**Metod 2: Chrome (visuell + pixelverifiering, OBLIGATORISK)**

Om Chrome-extension är ansluten (mcp__claude-in-chrome):

```
1. Navigera till https://mikbol.github.io/vilgot-garderob/
2. Scrolla igenom HELA sidan för att trigga lazy loading
3. Kör JavaScript som kontrollerar VARJE bild med img.complete && img.naturalWidth > 0
4. Kör JavaScript som hittar alla köp-länkar som pekar på /collections/ eller /market/ istället för /products/
5. scroll_to varje ny produkt och ta screenshot för att VISUELLT bekräfta att bilden visar rätt plagg
```

JavaScript för bildverifiering (kör EFTER scroll genom hela sidan):

```javascript
// Scrolla hela sidan först
async function verifyAll() {
  for (let y = 0; y < document.body.scrollHeight; y += 500) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 1000));

  // Kolla bilder
  const imgs = document.querySelectorAll('img');
  const broken = [];
  imgs.forEach(img => {
    if (!(img.complete && img.naturalWidth > 0)) {
      const parent = img.closest('[class]');
      const h3 = parent?.querySelector('h3');
      broken.push({ name: h3?.textContent || img.alt, src: img.src });
    }
  });

  // Kolla köp-länkar
  const buyLinks = Array.from(document.querySelectorAll('a')).filter(a => a.textContent.includes('Köp'));
  const badLinks = buyLinks.map(a => {
    let el = a;
    let name = '';
    for (let i = 0; i < 5; i++) { el = el.parentElement; if (!el) break; const h3 = el.querySelector('h3'); if (h3) { name = h3.textContent; break; } }
    const url = a.href;
    const isCollection = (url.includes('/collections') && !url.includes('/products/')) || url.includes('/market/');
    return isCollection ? { name, url } : null;
  }).filter(Boolean);

  return JSON.stringify({ brokenImages: broken, collectionLinks: badLinks }, null, 2);
}
verifyAll();
```

Om Chrome-extension INTE är ansluten: notera att visuell verifiering inte gjordes och dokumentera att det är en LUCKA.

**Metod 3: Bildverifiering via curl (obligatorisk om produkter lades till)**

```bash
# För varje ny bild, verifiera HTTP 200 från live-sajten
# Byt FILNAMN till faktiska filnamn från img/
curl -sL -o /dev/null -w 'HTTP %{http_code}: FILNAMN\n' "https://mikbol.github.io/vilgot-garderob/img/FILNAMN"
```

**Pass (ALLA dessa ska vara sanna):**
- Antal produkter matchar `./add-item.sh count` exakt
- Eventuella nya produkter syns med rätt namn och pris (WebFetch)
- Alla sektioner renderas (15 st)
- Alla nya bilder laddas (complete && naturalWidth > 0 i Chrome JS)
- Alla nya bilder returnerar HTTP 200 via curl
- Nya produkters köp-länkar pekar på produktsidor, INTE samlingssidor
- Screenshot av varje ny produkt visar en faktisk produktbild (inte placeholder, inte trasig ikon, inte fel produkt)

**Fail:** Något av ovanstående stämmer inte. Felsök, fixa, push igen, verifiera igen.

### Kända pre-existing problem (inte orsakade av auto-discovery)

Dessa fanns innan auto-discovery implementerades och berörs inte av den:

| Problem | Antal | Detaljer |
|---|---|---|
| Trasig bild | 1 | `lilax-tux-grey.webp` (Gentleman Tuxedo Footie) |
| Köp-länkar till samlingssidor | 13 | 7× The Tiny Universe → /collections/suits-tuxedos, 4× Jacadi → /collections/newborn-boy, 2× Etsy → /market/ |

Dessa bör fixas separat men blockerar inte auto-discovery.

### 7.4 Full körning (alla 5 agenter)

Kör bara efter att 7.1-7.3 lyckats.

```bash
BEFORE=$(./add-item.sh count)
./orchestrate.sh
AFTER=$(./add-item.sh count)
echo "Före: $BEFORE, Efter: $AFTER, Nya: $((AFTER - BEFORE))"
```

Tar 5-25 minuter (5 agenter × 1-5 min/agent).

**Kontrollera efteråt:**

```bash
# Diagnos (OBLIGATORISKT)
./diagnose-run.sh

# Se commits
git log --oneline -5
```

**Verifiera live-sajten igen** (samma procedur som 7.3: gh api status, WebFetch, curl för bilder).

**Pass:**
- Minst 3 av 5 agenter körde utan krasch
- Totalt minst 1 ny produkt (om alla 5 agenter hittar 0 nya, undersök varför)
- Live-sajten visar rätt antal produkter
- Alla nya bilder laddas (HTTP 200)

---

## Steg 8: Felsökning

### `opencode: command not found`

```bash
which opencode
# Om det inte hittas:
brew install opencode  # eller: go install github.com/opencode-ai/opencode@latest
```

Uppdatera PATH i launchd-plisten.

### `websearch` returnerar inga resultat

```bash
OPENCODE_ENABLE_EXA=true opencode run "Sök efter baby tuxedo"
```

Om Exa är nere finns ingen automatisk fallback. Vänta och kör igen nästa vecka.

### Agent hittar produkter men bildnedladdning misslyckas

`add-item.sh` validerar redan:
1. HTTP-status (måste vara 200)
2. Magic bytes (måste vara image/jpeg, image/png, image/webp, image/gif)

Om en sajt blockerar hotlinking (403), avvisas bilden och produkten läggs inte till. Detta är korrekt beteende.

### Agent hänger sig (timeout 124)

OpenCode issue #8203: agenten fick 429 rate limit och hänger. `timeout` dödar processen. Nästa agent körs ändå. Ingen data förloras.

### Agenten skickar ogiltigt format

`add-item.sh` avvisar och returnerar ERROR med specifikt felmeddelande. Agentens prompt säger att den ska läsa felmeddelandet och gå vidare. Inget skrivs till `index.html`.

---

## Steg 9: Underhåll

### Lägg till ny sektion

1. Lägg till sektionsnamnet i `VALID_SECTIONS` i `add-item.sh`
2. Lägg till sektionen i `index.html` under `const SECTIONS`
3. Commit och push

Agentens prompt behöver INTE uppdateras. Den kör `./add-item.sh sections` för att se listan.

### Byt modell

```bash
./orchestrate.sh --model openai/gpt-4o-mini --single 0 --no-push
```

### Rensa loggar

```bash
find logs/ -name "*.log" -mtime +30 -delete
```

### Ta bort felaktigt tillagd produkt (manuellt)

```bash
./add-item.sh list                    # Hitta ID
./add-item.sh remove --id 73         # Ta bort
git add index.html && git commit -m "remove: felaktig produkt" && git push
```

---

## Steg 10: Avinstallation

### Beslut (2026-03-17)

Det enda som behöver städas vid avinstallation är **launchd-jobbet**. Övriga filer (skript, loggar, bilder, config) lever i git-repot och gör ingen skada om de ligger kvar. De tar minimal plats och är versionshanterade.

### Vid avinstallation: städa launchd

```bash
# Stoppa och ta bort det schemalagda jobbet
launchctl unload ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist 2>/dev/null
rm -f ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist

# Verifiera att det är borta
launchctl list | grep vilgot    # ska ge tomt resultat

# Rensa launchd-loggar (valfritt, ligger i /tmp och försvinner vid omstart)
rm -f /tmp/vilgot-discovery.log /tmp/vilgot-discovery.err
```

Det är allt. Utan launchd-jobbet körs inget automatiskt. Skripten i repot är bara filer, de gör inget av sig själva.

### Varför resten kan ligga kvar

| Fil/katalog | Varför den inte behöver städas |
|---|---|
| `orchestrate.sh`, `opencode.json`, `agents/` | Inerta filer i git. Körs inte utan att någon aktivt startar dem. |
| `add-item.sh` (härdad) | Valideringen förbättrar skriptet oavsett om auto-discovery används. |
| `test-auto-discovery.sh` | Testskript. Användbart om systemet ska återaktiveras. |
| `logs/` | Gitignored, ~260 KB/år. Försvinner vid `rm -rf logs/*`. |
| `.gitignore` | Förhindrar att loggar och lockfiler hamnar i git. Gör ingen skada. |
| `~/.config/opencode/` | Delas med alla OpenCode-projekt. Rör den inte. |

---

## Kostnad

OpenCode Zen med gratis modell: $0/mån. Bildnedladdningsbandbredd försumbar. Om alla gratis modeller försvinner: GitHub Copilot Pro $10/mån (300 premium requests) eller Ollama $0 (begränsad funktion).

---

## Exekveringsordning

```
1.  ✅ Härda add-item.sh (validering + sections-kommando)
2.  ✅ Testa valideringen (steg 1.8, 8/8 OK)
3.  ✅ Skapa opencode.json (permissions, agent, nemotron-3-super-free)
4.  ✅ Skapa agents/product-scout.md
5.  ✅ Skapa orchestrate.sh + chmod +x
6.  ✅ Skapa .gitignore
7.  ✅ Skapa test-auto-discovery.sh (validering + OpenCode-pipeline)
8.  ✅ Konfigurera OpenCode Zen (/connect, gratis modell)
9.  ✅ Kör ./test-auto-discovery.sh (27/27 PASS)
10. ✅ Skarpt agenttest (3 produkter tillagda, lokal commit)
11. ✅ Push + live-verifiering (71 produkter, 3 nya bilder HTTP 200, WebFetch)
12. ⬜ Full körning alla 5 agenter (steg 7.4)
13. ⬜ Installera launchd (steg 6)
14. ⬜ Commit allt och push (workspace-repot)
```

---

## Acceptanskriterier

### Validering (steg 1) ✅

- [x] `add-item.sh` avvisar HTTP-URL (kräver HTTPS)
- [x] `add-item.sh` avvisar sök-URL:er (google.com, bing.com, etc.)
- [x] `add-item.sh` avvisar ogiltigt prisformat (t.ex. "around $30")
- [x] `add-item.sh` avvisar ogiltig sektion (inte i whitelist)
- [x] `add-item.sh` avvisar ogiltigt storleksformat (t.ex. "62" utan "Från")
- [x] `add-item.sh` kräver --brand (inte längre valfritt)
- [x] `add-item.sh` avvisar för kort/långt namn
- [x] `add-item.sh sections` listar alla giltiga sektioner
- [x] Befintlig bildvalidering (magic bytes) fungerar fortfarande (oförändrad)

### Permissions (steg 2) ✅ (verifierat 2026-03-17 via test-auto-discovery.sh + agentlogg)

- [x] Agenten kan köra `add-item.sh add`, `exists`, `count`, `list`, `sections`
- [x] Agenten kan INTE köra `add-item.sh remove` (blockeras av permissions)
- [x] Agenten kan INTE läsa/skriva/redigera filer direkt (read/edit deny)
- [x] Agenten kan INTE köra andra bash-kommandon (bash * deny)

### Orkestrering (steg 4) ✅ (verifierat 2026-03-17)

- [x] `orchestrate.sh --dry-run` visar plan utan att köra
- [x] `orchestrate.sh --single 0 --no-push` kör en agent och committar lokalt
- [ ] `orchestrate.sh` kör alla 5 agenter utan krasch
- [ ] Git commit och push fungerar automatiskt
- [x] Loggar skrivs till `logs/`

### End-to-end ✅ (verifierat 2026-03-17, single agent + push + live-sajt + Chrome)

- [x] Agent hittar minst 1 ny produkt vid testkörning (3 produkter, single agent)
- [x] Produkten passerar all validering i add-item.sh
- [x] Sajten pushad till GitHub, Pages status: "built"
- [x] Live-sajt renderar 71 produkter (WebFetch-verifierat mot mikbol.github.io)
- [x] 3 nya produkter syns med rätt namn och pris på live-sajten (WebFetch + Chrome find)
- [x] Alla 3 nya bilder returnerar HTTP 200 från live-sajten (curl)
- [x] 0 trasiga bilder bland nya produkter (Chrome JS: complete && naturalWidth > 0 + screenshot)
- [x] 0 samlingslänkar bland nya produkter (alla 3 pekar på produktsidor)
- [ ] 1 pre-existing trasig bild: lilax-tux-grey.webp (inte auto-discovery)
- [ ] 13 pre-existing samlingslänkar (inte auto-discovery)
- [x] 15 sektioner renderas korrekt (Chrome find: 15 + huvudrubrik)
- [x] Dark/light mode fungerar (Chrome find: "Byt tema"-knapp finns)
- [x] Inga JavaScript-fel
- [x] Gratis modell fungerar (nemotron-3-super-free, websearch + webfetch + add)
- [ ] launchd-jobb laddas och visas i `launchctl list` (steg 6 ej installerat ännu)
- [ ] Full körning med alla 5 agenter (steg 7.4)

### Buggar hittade och fixade under testning

| Bugg | Orsak | Fix |
|---|---|---|
| `flock: command not found` | macOS har inte `flock` (Linux-kommando) | Ersatt med `mkdir`-baserat lås (atomärt, cross-platform) |
| `timeout: command not found` | macOS har inte `timeout` (GNU coreutils) | Fallback till `gtimeout` eller körning utan timeout |
| OpenCode `-q` flag | OpenCode har ingen `-q` flagga | Borttagen ur alla anrop |
| `opencode.json` ogiltigt | `write`, `websearch`, `webfetch` hade objekt-format istället för strängar | Fixat till korrekt schema (strängar för enkla verktyg) |
| `$44.99` i dubbla citattecken | Shell expanderade `$44` till tom sträng | Agenten löste det själv med enkla citattecken vid retry |
| `timeout` saknas på macOS | Varken `timeout` eller `gtimeout` installerade | Bytt till `dg_timeout` som primär (finns i `~/.local/bin/`), `timeout` som fallback i sandbox/Linux |
| Timeout-detektion felaktig | `dg_timeout` returnerar exit 0 (inte 124 som GNU timeout) | Detekterar timeout via `duration >= TIMEOUT_SECS` som komplement till exit 124 |
| Föräldralösa bilder vid avbruten körning | Agenten laddar ned bild innan add-item.sh körs; om add misslyckas blir bilden kvar | Manuell städning: `git status --short \| grep '^?? img/' \| awk '{print $2}' \| xargs rm -f` |
| `mktemp` kollision | `/tmp/vg-product-XXXXXX.json` fanns kvar från förra körningen | add-item.sh bör använda unika tempfiler; workaround: rensa `/tmp/vg-product-*` |
