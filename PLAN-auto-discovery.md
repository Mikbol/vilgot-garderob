# Plan: Automatisk produktuppdatering med AI-agenter

Beslutad: 2026-03-16
Uppdaterad: 2026-03-17 (härdning, engine-val, valuta, sandbox-research)

## Mål

Sajten https://mikbol.github.io/vilgot-garderob/ uppdateras automatiskt med nya gentleman-babykläder. OpenCode-agenter med gratis modell söker webben, hittar produkter, och anropar `add-item.sh`. Ett cron-jobb kör agenterna och pushar till GitHub.

## Beslut

- **Engine:** OpenCode (primär och enda). Claude Code är inte ett alternativ.
- **Modell:** Gratis modell via OpenCode (konfigureras i `opencode.json`).
- **Valutor:** Alla accepteras (3-bokstavs ISO-koder + symboler).
- **Notiser:** Inte prioriterat. Kan läggas till senare vid behov.
- **Sandbox:** OpenCode i Docker-container undersöks separat (se `opencode/research/docker-sandbox.md`).

## Säkerhetsmodell

Agenten ska INTE behöva "göra rätt". Systemet tvingar rätt beteende genom tre lager:

1. **Permissions** begränsar vilka kommandon agenten kan köra
2. **Skriptet** validerar all indata och avvisar felaktigt format
3. **Prompten** instruerar agenten vad den ska göra

Om agenten hallucerar, skickar skräp, eller försöker köra oväntade kommandon, fångas det av lager 1 eller 2 innan något skrivs till `index.html`. Mänsklig inblandning ska inte behövas.

## Redan klart

- [x] `index.html` med `const PRODUCTS = [...]` (68 produkter, JSON-driven rendering)
- [x] `add-item.sh` (add, list, count, exists, remove, flock-lås, bildverifiering via magic bytes, dedup)
- [x] `json-helper.py` (raw_decode, atomic writes)
- [x] Research: agent-orkestrering, OpenCode, Shopify API, scraping, AI-discovery

## Filer som ska skapas/ändras

```
vilgot-kläder/site/
├── add-item.sh               # ÄNDRA: lägg till strikt validering (steg 1)
├── opencode.json              # NY: OpenCode projektkonfig (steg 2)
├── agents/
│   └── product-scout.md       # NY: Agent-definition (steg 3)
├── orchestrate.sh             # NY: Huvudskript (steg 4)
├── logs/                      # NY: Agent-loggar (gitignored)
└── .gitignore                 # NY: Ignorera logs/, .add-item.lock, *.tmp
```

---

## Steg 1: Härdning av add-item.sh

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

## Steg 2: OpenCode projektkonfig

**Fil:** `opencode.json`

Modell och provider konfigureras till en gratis modell. Exakt vilken avgörs vid implementation (beror på vad OpenCode stödjer och vad som har websearch/webfetch).

```json
{
  "model": "GRATIS_MODELL_HÄR",
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

## Steg 3: Agent-definition

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

## Steg 4: Orkestreringsscript

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

## Steg 5: .gitignore

**Fil:** `.gitignore`

```
logs/
.add-item.lock
*.tmp
index.html.bak
```

---

## Steg 6: Schemaläggning

### macOS launchd

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
        <key>ANTHROPIC_API_KEY</key>
        <string>REPLACE_WITH_ACTUAL_KEY</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
        <key>OPENCODE_ENABLE_EXA</key>
        <string>true</string>
    </dict>
</dict>
</plist>
```

### Öppen fråga: PATH och API-nyckel

- **API-nyckel:** Om den gratis modellen inte kräver API-nyckel kan `ANTHROPIC_API_KEY` tas bort ur plisten. Om den behöver en nyckel (t.ex. OpenRouter free tier) läggs den till här.
- **PATH:** Behöver inkludera katalogen där `opencode` är installerad. Kör `which opencode` för att avgöra.

### Installation

```bash
cp vilgot-garderob.discovery.plist ~/Library/LaunchAgents/
launchctl load -w ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist
launchctl list | grep vilgot  # verifiera
```

Kör söndagar kl 10:00. Om Mac:en sov vid den tiden körs jobbet vid nästa uppvakning.

---

## Steg 7: Första testkörning (manuell)

Kör stegen i ordning. Varje steg måste lyckas innan nästa.

### 7.1 Verifiera add-item.sh-validering

Kör testfallen från steg 1.8. Alla ogiltiga inputs ska avvisas.

### 7.2 Verifiera att OpenCode fungerar headless

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site
opencode run "Svara med exakt texten: HELLO" -q
```

Förväntat: `HELLO` (eller liknande kort svar).

### 7.3 Verifiera websearch

```bash
opencode run "Använd websearch för att söka efter 'baby tuxedo romper'. Lista 3 resultat med titel och URL." -q
```

Förväntat: 3 sökresultat med faktiska URL:er.

### 7.4 Verifiera att agenten kan köra add-item.sh

```bash
opencode run "Kör kommandot: ./add-item.sh count" -q
```

Förväntat: `68` (eller aktuellt antal).

### 7.5 Verifiera att agenten INTE kan köra remove

```bash
opencode run "Kör kommandot: ./add-item.sh remove --id 1" -q
```

Förväntat: permission denied (blockerat av opencode.json).

### 7.6 Testkörning med en agent (dry-run)

```bash
./orchestrate.sh --single 0 --dry-run
```

Förväntat: visar vad som skulle köras utan att göra något.

### 7.7 Testkörning med en agent (skarpt, utan push)

```bash
./orchestrate.sh --single 0 --no-push
```

Förväntat: Agenten söker, hittar 0-3 produkter, lägger till via add-item.sh. Commit skapas lokalt men pushas inte.

Kontrollera efteråt:
```bash
./add-item.sh count          # Bör vara >= 68
git log --oneline -3         # Se commit
cat logs/*agent-0*           # Se agentens logg
```

### 7.8 Verifiera att sidan renderar korrekt

Öppna `index.html` i browser lokalt och kontrollera:
- Alla befintliga produkter visas
- Eventuella nya produkter visas i rätt sektion
- Bilder laddas (inga trasiga bildikoner)
- Dark/light mode fungerar

### 7.9 Full testkörning (alla agenter, med push)

```bash
./orchestrate.sh
```

Vänta 5-15 min. Kontrollera:
```bash
git log --oneline -5
./add-item.sh count
```

Ladda sajten: https://mikbol.github.io/vilgot-garderob/ (vänta 1-2 min efter push).

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
OPENCODE_ENABLE_EXA=true opencode run "Sök efter baby tuxedo" -q
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

## Kostnad

Gratis modell via OpenCode = $0/mån. Enda kostnaden är bandbredd för bildnedladdning (försumbar).

---

## Exekveringsordning

```
1. Härda add-item.sh (validering + sections-kommando)  (20 min)
2. Testa valideringen (steg 1.8)                       (10 min)
3. Skapa opencode.json                                 (5 min)
4. Skapa agents/product-scout.md                       (5 min)
5. Skapa orchestrate.sh + chmod +x                     (5 min)
6. Skapa .gitignore                                    (1 min)
7. Testa steg 7.1-7.5 (validering + permissions)       (10 min)
8. Testa steg 7.6-7.7 (dry-run + single agent)         (10 min)
9. Verifiera rendering steg 7.8                        (5 min)
10. Full körning steg 7.9                              (15 min)
11. Installera launchd steg 6                          (5 min)
12. Commit allt och push                               (2 min)
```

Total tid: ~95 min.

---

## Acceptanskriterier

### Validering (steg 1)

- [ ] `add-item.sh` avvisar HTTP-URL (kräver HTTPS)
- [ ] `add-item.sh` avvisar sök-URL:er (google.com, bing.com, etc.)
- [ ] `add-item.sh` avvisar ogiltigt prisformat (t.ex. "around $30")
- [ ] `add-item.sh` avvisar ogiltig sektion (inte i whitelist)
- [ ] `add-item.sh` avvisar ogiltigt storleksformat (t.ex. "62" utan "Från")
- [ ] `add-item.sh` kräver --brand (inte längre valfritt)
- [ ] `add-item.sh` avvisar för kort/långt namn
- [ ] `add-item.sh sections` listar alla giltiga sektioner
- [ ] Befintlig bildvalidering (magic bytes) fungerar fortfarande

### Permissions (steg 2)

- [ ] Agenten kan köra `add-item.sh add`, `exists`, `count`, `list`, `sections`
- [ ] Agenten kan INTE köra `add-item.sh remove`
- [ ] Agenten kan INTE läsa/skriva/redigera filer direkt
- [ ] Agenten kan INTE köra andra bash-kommandon

### Orkestrering (steg 4)

- [ ] `orchestrate.sh --dry-run` visar plan utan att köra
- [ ] `orchestrate.sh --single 0 --no-push` kör en agent och committar lokalt
- [ ] `orchestrate.sh` kör alla 5 agenter utan krasch
- [ ] Git commit och push fungerar automatiskt
- [ ] Loggar skrivs till `logs/`

### End-to-end

- [ ] Agent hittar minst 1 ny produkt vid testkörning
- [ ] Produkten passerar all validering i add-item.sh
- [ ] Sidan renderar korrekt med nya produkter (browser-test)
- [ ] Sajten uppdateras på GitHub Pages
- [ ] launchd-jobb laddas och visas i `launchctl list`
- [ ] Gratis modell fungerar tillräckligt bra för att hitta och verifiera produkter
