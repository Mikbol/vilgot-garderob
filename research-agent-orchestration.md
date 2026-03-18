# Research: Parallell Agent-orkestrering med Claude Code headless

Undersökt: 2026-03-16

---

## Beslut

**OpenCode (`opencode run`) valdes som agentplattform.** Motivering: modellfrihet (billigare modeller möjliga), gratis Exa-websearch, och Mikael vill testa OpenCode i produktion. Kända risker (sessionsinterferens #4251, 429-häng #8203) accepteras och hanteras med workarounds. Claude Code är backup om OpenCode visar sig instabilt.

## Sammanfattning

Claude Code kan köras headless via `claude -p "prompt"`. OpenCode har motsvarigheten `opencode run "prompt"`. Flera instanser kan köras parallellt med `&` + `wait` i bash. WebSearch och WebFetch finns tillgängliga i båda. Bash-tool fungerar fullt ut, inklusive anrop till `add-item.sh`. Kostnaden per agent-körning med Haiku 4.5 landar runt $0.01-0.03, med GPT-4o-mini via OpenCode runt $0.004-0.008. Veckovis körning rekommenderas.

---

## 1. Claude Code headless (`claude -p`)

### Grundläggande användning

```bash
claude -p "Din prompt här"
```

Flaggan `-p` (alias `--print`) kör Claude Code icke-interaktivt. Prompten skickas, svaret skrivs till stdout, processen avslutas.

### Alla relevanta CLI-flaggor

| Flagga | Funktion | Exempel |
|--------|----------|---------|
| `-p "prompt"` | Headless mode, kör prompt och avsluta | `claude -p "Analysera koden"` |
| `--model` | Välj modell (alias: `sonnet`, `opus`, eller fullständigt namn) | `--model claude-haiku-4-5` |
| `--allowedTools` | Verktyg som körs utan bekräftelse (permission rule syntax) | `--allowedTools "Bash,WebSearch,WebFetch,Read"` |
| `--disallowedTools` | Verktyg som tas bort helt ur kontexten | `--disallowedTools "Edit,Write"` |
| `--tools` | Begränsar vilka verktyg som finns tillgängliga (tar bort ur context window) | `--tools "Bash,Read,WebSearch"` |
| `--output-format` | `text` (default), `json`, `stream-json` | `--output-format json` |
| `--json-schema` | Tvingar validerad JSON-output efter agentens arbetsflöde | `--json-schema '{"type":"object",...}'` |
| `--max-turns` | Max antal agentvarv (exit med fel vid gräns) | `--max-turns 10` |
| `--max-budget-usd` | Max dollarbelopp per körning | `--max-budget-usd 0.50` |
| `--append-system-prompt` | Lägg till text till default system prompt | `--append-system-prompt "Skriv på svenska"` |
| `--system-prompt` | Ersätt hela system prompt | `--system-prompt "Du är en produktsökare"` |
| `--add-dir` | Ge tillgång till extra kataloger | `--add-dir ../shared-scripts` |
| `--fallback-model` | Fallback vid överbelastning (print mode only) | `--fallback-model haiku` |
| `--no-session-persistence` | Spara inte sessionen till disk | `--no-session-persistence` |
| `--continue` / `--resume` | Fortsätt tidigare konversation | `--continue` eller `--resume $SESSION_ID` |
| `--dangerously-skip-permissions` | Hoppa över alla bekräftelser (FARLIGT) | Undvik i produktion |

### Verktyg tillgängliga i headless mode

Claude Code har dessa inbyggda verktyg:

- **Bash** (kör kommandon)
- **Read** (läs filer)
- **Edit** (redigera filer)
- **Write** (skriv filer)
- **Grep** (sök i filer)
- **Glob** (hitta filer)
- **WebSearch** (sök webben, $0.01/sökning)
- **WebFetch** (hämta och sammanfatta webbsidor, ingår i tokens)

WebSearch och WebFetch kräver att de specificeras i `--allowedTools` för att köras utan bekräftelse i headless mode.

**Känt problem:** I `claude-code-action` (GitHub Actions-varianten) finns en bugg (issue #690) där WebSearch/WebFetch disablas av default via `DISALLOWED_TOOLS`. Fix pågår (PR #1033). I vanlig CLI (`claude -p`) fungerar de genom att ange dem i `--allowedTools`.

### Miljövariabler

```bash
# API-nyckel (krävs för headless utan prenumeration)
export ANTHROPIC_API_KEY="sk-ant-..."

# Alternativt: Claude Code Max-prenumeration fungerar automatiskt
# (behöver ingen API-nyckel om du är inloggad)
```

### Working directory

Claude Code använder nuvarande `pwd` som arbetsyta. Byt katalog innan anropet:

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site && claude -p "..."
```

Eller ge tillgång till extra kataloger:

```bash
claude -p "..." --add-dir /Users/bolm/AI-Assistent/vilgot-kläder/site
```

---

## 2. Parallell exekvering av agenter

### Bash-mönster: bakgrundsprocesser + wait

```bash
#!/bin/bash
set -euo pipefail

SITE_DIR="/Users/bolm/AI-Assistent/vilgot-kläder/site"
LOG_DIR="$SITE_DIR/logs"
mkdir -p "$LOG_DIR"
DATE=$(date '+%Y-%m-%d_%H%M')

# Definiera sökfokus per agent
declare -a SEARCHES=(
  "baby tuxedo suit formal outfit newborn infant"
  "baby bow tie suspender romper gentleman outfit"
  "baby sailor suit nautical outfit infant formal"
  "baby blazer vest waistcoat formal infant"
  "baby christening outfit baptism formal gentleman"
)

PIDS=()

for i in "${!SEARCHES[@]}"; do
  SEARCH="${SEARCHES[$i]}"
  LOG_FILE="$LOG_DIR/agent-${i}-${DATE}.log"

  (
    cd "$SITE_DIR"
    claude -p "
Du söker efter gentleman-babykläder med fokus på: $SEARCH

INSTRUKTIONER:
1. Använd WebSearch för att hitta produkter som matchar.
2. För varje produkt du hittar, verifiera med WebFetch att den finns och hämta exakt pris, namn, URL och bild-URL.
3. Kör ./add-item.sh exists --url \"URL\" för att kontrollera dubbletter INNAN du lägger till.
4. Om produkten inte redan finns, kör:
   ./add-item.sh add --name \"NAMN\" --price \"PRIS\" --url \"URL\" --image-url \"BILD_URL\" --brand \"MÄRKE\" --no-commit
5. Lägg BARA till produkter som är gentleman-stil: smoking, kostym, fluga, hängslen, väst, blazer, sjömanskostym, formella rompers.
6. Max 3 produkter per körning. Kvalitet före kvantitet.
7. Om add-item.sh returnerar 'already exists', gå vidare till nästa produkt.
" \
      --model claude-haiku-4-5 \
      --allowedTools "WebSearch,WebFetch,Bash(./add-item.sh *),Bash(curl *),Read" \
      --max-turns 15 \
      --max-budget-usd 0.10 \
      --output-format json \
      --no-session-persistence \
      2>&1
  ) > "$LOG_FILE" &

  PIDS+=($!)
  echo "Agent $i started (PID ${PIDS[-1]}): $SEARCH"
done

echo "Waiting for ${#PIDS[@]} agents to complete..."

# Vänta på alla och samla exit codes
FAILURES=0
for i in "${!PIDS[@]}"; do
  if wait "${PIDS[$i]}"; then
    echo "Agent $i completed successfully"
  else
    echo "Agent $i failed (exit code $?)"
    FAILURES=$((FAILURES + 1))
  fi
done

echo "All agents done. Failures: $FAILURES"
```

### Alternativ: xargs för enklare syntax

```bash
#!/bin/bash
SITE_DIR="/Users/bolm/AI-Assistent/vilgot-kläder/site"

run_agent() {
  local search="$1"
  cd "$SITE_DIR"
  claude -p "Sök efter gentleman-babykläder: $search. Använd WebSearch, verifiera med WebFetch, lägg till via ./add-item.sh add --no-commit." \
    --model claude-haiku-4-5 \
    --allowedTools "WebSearch,WebFetch,Bash(./add-item.sh *),Read" \
    --max-turns 15 \
    --max-budget-usd 0.10 \
    --no-session-persistence \
    2>&1
}

export -f run_agent
export SITE_DIR

printf '%s\n' \
  "baby tuxedo suit" \
  "baby bow tie suspender" \
  "baby sailor suit" \
  "baby blazer vest" \
  "baby christening formal" | \
  xargs -P 5 -I {} bash -c 'run_agent "$@"' _ {}
```

### Begränsningar vid parallell körning

1. **File locking.** `add-item.sh` har redan `flock`-baserad låsning. Två agenter kan inte skriva till `index.html` samtidigt. Den som kommer sist väntar tills låset släpps.
2. **API rate limits.** Anthropic API: 1000 req/min för Haiku 4.5 (Tier 1). 5 parallella agenter klaras utan problem.
3. **Ingen Git-konflikt.** Agenter kör med `--no-commit`. Git commit + push sker en gång efter att alla agenter är klara.

---

## 3. Agent som anropar bash-skript

### Fungerar det?

Ja. Headless Claude Code har full tillgång till Bash-verktyget. Med `--allowedTools "Bash(./add-item.sh *)"` kan agenten köra alla varianter av add-item.sh utan bekräftelse.

### Exakt syntax

```bash
claude -p "Lägg till produkten 'Baby Tuxedo Romper' från example.com" \
  --allowedTools "Bash(./add-item.sh *)" \
  --model claude-haiku-4-5
```

Agenten kan då köra:

```bash
./add-item.sh exists --url "https://example.com/baby-tuxedo"
./add-item.sh add --name "Baby Tuxedo Romper" --price "499 kr" \
  --url "https://example.com/baby-tuxedo" \
  --image-url "https://cdn.example.com/img.jpg" \
  --brand "ExampleBrand" --no-commit
```

### Begränsningar

- **`--allowedTools` mönster**: `Bash(./add-item.sh *)` tillåter alla kommandon som börjar med `./add-item.sh`. Mellanslaget före `*` är viktigt. Utan det matchar `Bash(./add-item.sh*)` även `./add-item.shANNAT`.
- **Bash-verktyget lägger till 245 input tokens** per anrop till API-kostnaden.
- **Timeout**: Bash-kommandon har en default timeout. `add-item.sh` med bildnedladdning tar typiskt 5-15 sekunder, väl inom gränsen.
- **Exit codes**: Om `add-item.sh` returnerar non-zero (t.ex. "already exists"), ser agenten felmeddelandet och kan agera på det.

### Restriktivare tooling

För maximal säkerhet, begränsa Bash till exakt de kommandon som behövs:

```bash
--allowedTools "Bash(./add-item.sh add *),Bash(./add-item.sh exists *),Bash(./add-item.sh count)"
```

Eller begränsa hela verktygsuppsättningen med `--tools`:

```bash
--tools "Bash,Read,WebSearch,WebFetch" \
--allowedTools "Bash(./add-item.sh *),WebSearch,WebFetch,Read"
```

`--tools` tar bort verktyg ur context window helt (agenten vet inte att de finns). `--allowedTools` styr bara behörigheter.

---

## 4. Kostnadsanalys

### Modellpriser (aktuella per mars 2026)

| Modell | Input | Output | WebSearch |
|--------|-------|--------|-----------|
| Claude Sonnet 4.6 | $3/MTok | $15/MTok | $10/1000 sökningar |
| Claude Haiku 4.5 | $1/MTok | $5/MTok | $10/1000 sökningar |
| Claude Opus 4.6 | $5/MTok | $25/MTok | $10/1000 sökningar |

WebFetch: ingen extra kostnad utöver tokens.

### Uppskattad tokenförbrukning per agent

En agent som söker, verifierar, och lägger till 2-3 produkter:

| Steg | Input tokens | Output tokens |
|------|-------------|---------------|
| System prompt + verktyg | ~1500 | 0 |
| User prompt | ~300 | 0 |
| WebSearch (2-3 sökningar) | ~3000-5000 (resultat) | ~200 (sökfrågor) |
| WebFetch (3-5 sidhämtningar) | ~5000-15000 (sidinnehåll) | ~500 (frågor) |
| Bash(add-item.sh) calls (3-4 st) | ~1000 (output) | ~400 (kommandon) |
| Agentens resonemang (10-15 turns) | ~2000 (ackumulerad kontext) | ~2000 |
| **Totalt per agent** | **~13000-25000** | **~3000-4000** |

### Kostnad per körning (1 agent)

| Modell | Input | Output | WebSearch (3 sökningar) | Totalt |
|--------|-------|--------|------------------------|--------|
| Haiku 4.5 | $0.013-0.025 | $0.015-0.020 | $0.03 | **$0.05-0.08** |
| Sonnet 4.6 | $0.039-0.075 | $0.045-0.060 | $0.03 | **$0.11-0.17** |

### Kostnad per körning (5 agenter parallellt)

| Modell | 5 agenter | Batteri | Per dag (96x) | Per månad | Per år |
|--------|-----------|---------|---------------|-----------|--------|
| Haiku 4.5 | $0.25-0.40 | var 15 min | $24-38 | **$720-1150** | **$8640-13800** |
| Haiku 4.5 | $0.25-0.40 | 1x/dag | $0.25-0.40 | **$7.50-12** | **$90-144** |
| Haiku 4.5 | $0.25-0.40 | 1x/vecka | $0.25-0.40 | **$1-1.70** | **$13-20** |
| Sonnet 4.6 | $0.55-0.85 | var 15 min | $53-82 | **$1590-2460** | **$19k-29k** |
| Sonnet 4.6 | $0.55-0.85 | 1x/vecka | $0.55-0.85 | **$2.20-3.40** | **$29-44** |

### Slutsats om kostnad

- **Var 15:e minut med 5 agenter: $720-1150/månad med Haiku.** Omotiverat. Butikerna uppdaterar inte var 15:e minut.
- **1x/dag med 5 agenter: $7-12/månad med Haiku.** Rimligt om man vill vara aggressiv.
- **1x/vecka med 5 agenter: $1-2/månad med Haiku.** Optimal avvägning kostnad/nytta.
- Sonnet 4.6 behövs inte. Haiku 4.5 klarar "sök + extrahera + anropa skript" utmärkt.
- `--max-budget-usd 0.10` per agent förhindrar skenande kostnader.

---

## 5. Komplett orkestreringsscript

```bash
#!/bin/bash
# orchestrate-discovery.sh
# Kör N Claude-agenter parallellt för produktsökning.
# Varje agent söker med olika fokus, lägger till produkter via add-item.sh,
# och efter alla agenter är klara görs en sammanlagd git push.
#
# Användning:
#   ./orchestrate-discovery.sh              # Kör alla 5 agenter
#   ./orchestrate-discovery.sh --dry-run    # Visa vad som skulle hända
#   ./orchestrate-discovery.sh --agent 2    # Kör bara agent 2

set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SITE_DIR/logs"
DATE=$(date '+%Y-%m-%d_%H%M%S')
DRY_RUN=false
SINGLE_AGENT=""
MODEL="claude-haiku-4-5"
MAX_BUDGET="0.10"
MAX_TURNS="15"

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --agent) SINGLE_AGENT="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --budget) MAX_BUDGET="$2"; shift 2 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"

# Sökfokus per agent
declare -a AGENT_NAMES=(
  "tuxedo-formal"
  "bow-tie-suspender"
  "sailor-nautical"
  "blazer-vest"
  "christening-baptism"
)

declare -a AGENT_SEARCHES=(
  "baby tuxedo suit formal outfit gentleman infant newborn"
  "baby bow tie suspender romper gentleman outfit onesie"
  "baby sailor suit nautical outfit infant formal marine"
  "baby blazer vest waistcoat formal infant gentleman"
  "baby christening outfit baptism formal gentleman white"
)

# Gemensam agent-prompt (undviker upprepning)
AGENT_PROMPT_TEMPLATE='Du söker efter gentleman-babykläder (storlek 44-86, prematur till 18 månader).

DITT SÖKFOKUS: __SEARCH_FOCUS__

ARBETSFLÖDE:
1. Använd WebSearch för att hitta produkter. Sök på engelska och svenska. Prova variationer av söktermer.
2. För varje lovande träff, använd WebFetch för att verifiera att produkten finns och hämta exakt:
   - Produktnamn (originalspråk)
   - Pris (inkl. valuta)
   - Produktsidans URL
   - Bild-URL (en direkt bildlänk, inte en sidsökväg)
   - Märke/brand
3. Kontrollera om produkten redan finns: ./add-item.sh exists --url "URL"
4. Om den INTE finns, lägg till: ./add-item.sh add --name "NAMN" --price "PRIS" --url "URL" --image-url "BILD_URL" --brand "MÄRKE" --no-commit
5. Om add-item.sh returnerar fel om "already exists", gå vidare utan att rapportera det som problem.

KVALITETSKRAV:
- BARA gentleman-stil: smoking, kostym, fluga, hängslen, väst, slips, blazer, sjömanskostym, formella rompers, dopkläder
- ALDRIG vardagskläder, klänningar, casual bodys utan formell detalj, skor utan formell stil
- ALDRIG hallucera produkter. Om du inte hittar exakt pris/URL via WebFetch, hoppa över produkten.
- Max 3 produkter. Bättre att lägga till 1 verifierad produkt än 3 osäkra.
- Föredra kända butiker: Childrensalon, Feltman Brothers, The Tiny Universe, Jacadi, Lulu Babe, ONEA Kids, Cuddle Sleep Dream, Mamas & Papas, Janie and Jack
- Om du hittar en ny butik med genuint gentleman-babykläder, ta med den också.'

run_agent() {
  local idx="$1"
  local name="${AGENT_NAMES[$idx]}"
  local search="${AGENT_SEARCHES[$idx]}"
  local log_file="$LOG_DIR/${DATE}_agent-${idx}-${name}.log"

  # Bygg prompt med sökfokus
  local prompt="${AGENT_PROMPT_TEMPLATE//__SEARCH_FOCUS__/$search}"

  echo "[$(date '+%H:%M:%S')] Agent $idx ($name) starting..." | tee -a "$log_file"

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] Would run: claude -p '...$search...' --model $MODEL" | tee -a "$log_file"
    return 0
  fi

  cd "$SITE_DIR"
  local start_time=$(date +%s)

  claude -p "$prompt" \
    --model "$MODEL" \
    --allowedTools "WebSearch,WebFetch,Bash(./add-item.sh *),Bash(curl *),Read" \
    --max-turns "$MAX_TURNS" \
    --max-budget-usd "$MAX_BUDGET" \
    --output-format json \
    --no-session-persistence \
    >> "$log_file" 2>&1

  local exit_code=$?
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  echo "[$(date '+%H:%M:%S')] Agent $idx ($name) finished in ${duration}s (exit: $exit_code)" | tee -a "$log_file"
  return $exit_code
}

# Bestäm vilka agenter som ska köras
if [ -n "$SINGLE_AGENT" ]; then
  INDICES=("$SINGLE_AGENT")
else
  INDICES=($(seq 0 $((${#AGENT_NAMES[@]} - 1))))
fi

# Räkna produkter före
BEFORE_COUNT=$(cd "$SITE_DIR" && ./add-item.sh count 2>/dev/null || echo "0")

echo "=== Orchestrator starting at $(date) ==="
echo "Agents: ${#INDICES[@]}, Model: $MODEL, Budget: $MAX_BUDGET/agent"
echo "Products before: $BEFORE_COUNT"
echo ""

# Lansera agenter parallellt
PIDS=()
for idx in "${INDICES[@]}"; do
  run_agent "$idx" &
  PIDS+=($!)
done

# Vänta på alla
FAILURES=0
for i in "${!PIDS[@]}"; do
  idx="${INDICES[$i]}"
  if wait "${PIDS[$i]}"; then
    echo "Agent $idx: OK"
  else
    echo "Agent $idx: FAILED"
    FAILURES=$((FAILURES + 1))
  fi
done

echo ""

# Räkna produkter efter
AFTER_COUNT=$(cd "$SITE_DIR" && ./add-item.sh count 2>/dev/null || echo "0")
NEW_COUNT=$((AFTER_COUNT - BEFORE_COUNT))

echo "Products after: $AFTER_COUNT (${NEW_COUNT} new)"

# Git commit + push (bara om nya produkter tillkom)
if [ "$NEW_COUNT" -gt 0 ] && [ "$DRY_RUN" = false ]; then
  cd "$SITE_DIR"
  git add index.html img/
  git commit -m "auto: add $NEW_COUNT new gentleman baby clothes

Sources: ${#INDICES[@]} parallel agents, model: $MODEL
Searches: ${AGENT_SEARCHES[*]:0:${#INDICES[@]}}"
  git push origin main
  echo "Pushed $NEW_COUNT new products to GitHub."
elif [ "$NEW_COUNT" -eq 0 ]; then
  echo "No new products found. Nothing to push."
fi

# Sammanfattning
echo ""
echo "=== Summary ==="
echo "Time: $(date)"
echo "Agents run: ${#INDICES[@]}"
echo "Failures: $FAILURES"
echo "New products: $NEW_COUNT"
echo "Logs: $LOG_DIR/${DATE}_agent-*"
```

---

## 6. Förhindra skräpprodukter

### Problembeskrivning

En headless agent som söker webben och anropar ett skript kan:
- Hallucera produkter (URL:er som inte finns)
- Lägga till irrelevanta produkter (casual kläder, fel kategori)
- Extrahera fel data (fel pris, fel bild-URL)
- Lägga till samma produkt igen

### Promptstruktur som förebygger skräp

Prompten ovan använder dessa tekniker:

1. **Explicit arbetsflöde i ordnade steg.** Agenten söker, verifierar med WebFetch, kontrollerar dubbletter, och lägger sedan till. Inte "hitta och lägg till" i ett steg.

2. **Verifieringssteg före tillägg.** `./add-item.sh exists --url` körs INNAN `add-item.sh add`. Om URL:en redan finns, hoppar agenten över.

3. **Maxgräns per agent.** "Max 3 produkter" förhindrar att en agent spammar 20 osäkra träffar.

4. **Negativlista.** Explicit "ALDRIG vardagskläder, klänningar, casual bodys" tvingar agenten att filtrera.

5. **Kvalitet före kvantitet.** "Bättre att lägga till 1 verifierad produkt än 3 osäkra" minskar incitamentet att gissa.

6. **add-item.sh som sista försvarslinje.** Skriptet:
   - Kontrollerar URL-duplikater
   - Verifierar att nedladdad bild faktiskt är en bild (MIME-type check)
   - Har `flock` för att förhindra race conditions vid parallell körning
   - Exiterar med non-zero vid fel, som agenten kan hantera

### Extra säkerhetslager

```bash
# --max-budget-usd begränsar kostnaden per agent
--max-budget-usd 0.10

# --max-turns begränsar antal steg
--max-turns 15

# Bash-restriktioner: tillåt BARA add-item.sh och curl
--allowedTools "Bash(./add-item.sh *),Bash(curl *)"
```

### Vad som INTE förhindras av prompten

- **Trasiga bild-URL:er.** WebFetch kan inte ladda ner bilder. Agenten måste använda `curl` eller lita på att `add-item.sh` gör det. Om CDN:en kräver auth-headers misslyckas nedladdningen och `add-item.sh` avbryter.
- **Felaktigt pris.** Om WebFetch sammanfattar priset som "around $30" istället för "$27.99" lagras den approximativa versionen. Motåtgärd: instruera agenten att kopiera pris bokstavligt.
- **Butik med helt felaktig kategorisering.** Om en butik kallar en rosa klänning "gentleman romper" hamnar den fel. Låg sannolikhet givet de butiker som rekommenderas.

### Post-mortem: manuell granskning

Orkestreringsscriptet loggar allt till `logs/`. En snabb granskning efter körning:

```bash
# Visa vilka produkter som lades till senaste körningen
git log --oneline -1 --format='%H' | xargs git show --stat

# Visa antal produkter som varje agent la till (från loggar)
grep -c "add-item.sh add" logs/*agent-*.log
```

---

## 7. Rate limiting och schemaläggning

### Var 15:e minut (96 ggr/dag) med 5 agenter

| Problem | Konsekvens |
|---------|-----------|
| Butiker uppdaterar 1-4 ggr/månad | 99%+ av körningarna hittar inget nytt |
| Kostnad: $720-1150/månad med Haiku | ~$9000-14000/år för en hobby-lookbook |
| WebSearch returnerar cachade resultat | Samma topp-10 resultat varje gång |
| API rate limits | 480 agentanrop/dag nära Tier 1-gräns |

**Bedömning: starkt omotiverat.**

### Förhindra att samma produkter hittas varje gång

1. **URL-dedup via add-item.sh.** Redan implementerat. Agenten kör `exists --url` och skriptet returnerar error om produkten finns.

2. **Sökvariation.** Varje agent har olika sökfokus. Dessutom kan prompten instruera: "Sök produkter jag sannolikt INTE redan har. Variera söktermer mellan körningar."

3. **Begränsad effekt.** WebSearch har ingen "exclude these results" funktion. Samma sökfråga ger ungefär samma resultat. Variation uppnås genom:
   - Olika sökfrågor per agent
   - Rotera sökfrågor mellan veckor
   - Inkludera datumrelaterade sökord ("new arrivals 2026", "spring collection")

4. **Rotationsschema:**

```bash
# Vecka 1: Standard-sökningar
declare -a WEEK1=("baby tuxedo" "baby bow tie" "baby sailor" "baby blazer" "baby christening")

# Vecka 2: Märkes-fokus
declare -a WEEK2=("Jacadi baby formal" "Childrensalon baby suit" "Feltman Brothers" "Janie and Jack formal" "Mamas Papas formal")

# Vecka 3: Säsong/nyhet
declare -a WEEK3=("new baby gentleman clothes 2026" "baby formal spring collection" "luxury baby outfit" "designer baby suit" "baby wedding outfit")

# Vecka 4: Svenska butiker + nischade
declare -a WEEK4=("baby kostym svensk" "bebis smoking" "dopkläder pojke" "ONEA Kids" "baby formal Scandinavia")

WEEK_NUM=$(( ($(date +%V) - 1) % 4 ))
eval "SEARCHES=(\"\${WEEK$((WEEK_NUM + 1))[@]}\")"
```

### Rekommenderad frekvens

| Frekvens | Kostnad/månad (Haiku, 5 agenter) | Motivering |
|----------|----------------------------------|-----------|
| **1x/vecka** | $1-2 | Optimal. Fångar allt, billigt. |
| 2x/vecka | $2-4 | Rimligt vid säsongsbyten. |
| 1x/dag | $7-12 | Bara om du vill ha aggressiv discovery. |
| Var 15 min | $720-1150 | Meningslöst. Butiker uppdaterar inte så ofta. |

---

## 8. `claude -p` specifik referens

### Fullständigt kommando med alla relevanta flaggor

```bash
claude -p "PROMPT_HÄR" \
  --model claude-haiku-4-5 \
  --allowedTools "WebSearch,WebFetch,Bash(./add-item.sh *),Read" \
  --max-turns 15 \
  --max-budget-usd 0.10 \
  --output-format json \
  --no-session-persistence \
  --append-system-prompt "Svara på svenska. Var kortfattad."
```

### `--allowedTools` syntax

Använder permission rule syntax. Stöder prefix-matching med `*`:

```bash
# Tillåt specifika Bash-kommandon
--allowedTools "Bash(./add-item.sh *)" "Bash(curl *)"

# Tillåt alla Bash-kommandon (OSÄKERT)
--allowedTools "Bash"

# Tillåt specifika verktyg utan restriktioner
--allowedTools "WebSearch,WebFetch,Read"

# Git-operationer
--allowedTools "Bash(git diff *)" "Bash(git log *)" "Bash(git status *)"
```

Viktigt: mellanslag före `*` gör att `Bash(git diff *)` matchar `git diff main` men INTE `git diff-index`. Utan mellanslag: `Bash(git diff*)` matchar båda.

### `--model` alternativ

```bash
--model sonnet              # Alias för senaste Sonnet (4.6)
--model opus                # Alias för senaste Opus (4.6)
--model claude-haiku-4-5    # Fullständigt namn
--model claude-sonnet-4-6   # Fullständigt namn
```

Haiku stöds inte som alias. Använd fullständigt namn `claude-haiku-4-5`.

### `--output-format` alternativ

| Format | Beskrivning | Användning |
|--------|-------------|-----------|
| `text` | Ren text (default) | Mänsklig läsning, enkel pipe |
| `json` | JSON med result, session_id, metadata | Maskinell parsing, `jq` |
| `stream-json` | Newline-delimited JSON, realtid | Streaming, progress bars |

JSON-output med `jq`:

```bash
# Hämta bara textresultatet
claude -p "..." --output-format json | jq -r '.result'

# Hämta session_id för att fortsätta konversationen
SESSION=$(claude -p "..." --output-format json | jq -r '.session_id')
claude -p "Fortsätt" --resume "$SESSION"
```

### `--json-schema` för strukturerad output

```bash
claude -p "Hitta 3 babykostymer" \
  --output-format json \
  --json-schema '{
    "type": "object",
    "properties": {
      "products": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "price": {"type": "string"},
            "url": {"type": "string", "format": "uri"},
            "image_url": {"type": "string", "format": "uri"},
            "brand": {"type": "string"},
            "size": {"type": "string"}
          },
          "required": ["name", "price", "url"]
        }
      }
    },
    "required": ["products"]
  }'
```

Resultatet hamnar i `.structured_output` (inte `.result`):

```bash
claude -p "..." --output-format json --json-schema '...' | jq '.structured_output.products'
```

### Miljövariabler

```bash
# API-nyckel
export ANTHROPIC_API_KEY="sk-ant-..."

# Eller: använd Claude Max-prenumeration (ingen API-nyckel behövs)
# Logga in en gång: claude auth login
```

---

## Evidensluckor

- **WebSearch i headless med Haiku.** Ej empiriskt testat. WebSearch är en server-side tool som fungerar med alla modeller (bekräftat i dokumentationen), men token-förbrukning per sökning varierar med modell. Haiku-agenten kan producera sämre sökfrågor än Sonnet.
- **`--max-budget-usd` precision.** Dokumentationen säger inte om WebSearch-kostnaden ($0.01/sökning) räknas in i budget-gränsen eller bara tokens.
- **`add-item.sh` under parallell last.** `flock` borde hantera det, men ej testat med 5 simultana agenter som alla försöker skriva samtidigt. Risk: timeout vid lång bildnedladdning medan flock hålls.
- **WebSearch dedup.** Ingen funktion för att exkludera redan besökta URL:er. Agenten kan inte be WebSearch "visa mig INTE dessa resultat". Enda mitigation: sökvariation + URL-check via add-item.sh.
- **`claude-code-action` bugg (#690).** WebSearch/WebFetch disablas av default i GitHub Actions-varianten. Workaround: använd vanlig `claude -p` istället för `claude-code-action`. Fix pågår.
- **Haiku 4.5 multi-step reasoning.** Agentic workflow med 10-15 turns kan vara utmanande för Haiku. Om kvaliteten är för låg, byt till Sonnet 4.6 (3x dyrare men betydligt bättre resonemang).

---

## 9. OpenCode som alternativ

Undersökt: 2026-03-16

### 9.1 Headless/icke-interaktivt läge

OpenCode har en direkt motsvarighet till `claude -p`: kommandot `opencode run`.

```bash
opencode run "Sök efter gentleman-babykläder och lägg till via add-item.sh"
```

**Jämförelse av headless-kommandon:**

| Funktion | Claude Code | OpenCode |
|----------|------------|----------|
| Headless-kommando | `claude -p "prompt"` | `opencode run "prompt"` |
| JSON-output | `--output-format json` | `--format json` |
| Modellval | `--model claude-haiku-4-5` | `--model provider/model` (t.ex. `anthropic/claude-haiku-4-5`) |
| Max turns | `--max-turns 15` | `steps`-fält i agent-config (ej CLI-flagga) |
| Budget-gräns | `--max-budget-usd 0.10` | Ingen motsvarighet |
| Tyst läge | Inget | `-q` / `--quiet` (döljer spinner) |
| Fortsätt session | `--continue` / `--resume $ID` | `--continue` / `--session $ID` |
| Bifoga fil | Inget | `--file` / `-f` |
| Strukturerad output | `--json-schema '{...}'` | Ej implementerat (issue #10456, öppen) |
| System prompt | `--system-prompt` / `--append-system-prompt` | Via agent-definition (markdown/JSON) |
| Permissions skip | `--dangerously-skip-permissions` | `"permission": {"*": "allow"}` i config |

**Viktiga skillnader:**

1. **Ingen `--max-budget-usd`.** OpenCode saknar budgetbegränsning per körning. Kostnadskontroll måste ske via `steps`-begränsning i agent-config eller extern timeout (`timeout 120 opencode run "..."`).

2. **Ingen `--max-turns` som CLI-flagga.** Motsvarigheten är `steps`-fältet i agent-definitionen, vilket kräver en konfigurationsfil snarare än en enkel flagga.

3. **Ingen `--json-schema`.** Claude Codes möjlighet att tvinga strukturerad output med schema-validering saknas helt. Feature request (issue #10456) är öppen sedan januari 2026.

4. **Persistent server.** `opencode serve` + `opencode run --attach` undviker kall start vid upprepade körningar. Claude Code saknar motsvarighet; varje `claude -p` är en kall start.

**Schemaläggning via plugin:** Pluginet [opencode-scheduler](https://github.com/different-ai/opencode-scheduler) kör `opencode run` via OS-schemaläggare (launchd på macOS, systemd på Linux, cron som fallback). Version 1.2.0, 186 stars. Sätter automatiskt `OPENCODE_PERMISSION=deny` för att förhindra interaktiva promptar vid schemalagda körningar. Förhindrar överlappande körningar (hoppar över om föregående fortfarande körs).

### 9.2 Tillgängliga verktyg

OpenCode har en jämförbar verktygsuppsättning med Claude Code:

| Verktyg | Claude Code | OpenCode | Skillnad |
|---------|------------|----------|----------|
| Bash/shell | Bash | bash | Likvärdig |
| Läs fil | Read | read | Likvärdig |
| Skriv fil | Write | write | Likvärdig |
| Redigera fil | Edit | edit, multiedit, patch | OpenCode har fler varianter |
| Sök i filer | Grep | grep | Likvärdig |
| Hitta filer | Glob | glob, list | Likvärdig |
| Webbsökning | WebSearch ($0.01/sökning) | websearch (Exa AI, gratis) | Se nedan |
| Hämta webbsida | WebFetch (ingår i tokens) | webfetch (5MB-gräns) | Se nedan |
| Todohantering | Ingen | todowrite, todoread | OpenCode extra |
| LSP | Ingen | lsp (experimentellt) | OpenCode extra |
| Fråga användare | Ingen | question | Irrelevant i headless |

**WebSearch-skillnaden:**

Claude Codes WebSearch kostar $0.01 per sökning och drivs av Anthropics egna sökinfrastruktur. OpenCodes websearch använder [Exa AI](https://exa.ai) utan separat API-nyckel och utan explicit per-sökning-kostnad. Aktiveras via `OPENCODE_ENABLE_EXA=true` eller `OPENCODE_EXPERIMENTAL=true`.

Exa returnerar 8 resultat per sökning med sökdjup: `auto` (default), `fast` eller `deep`. Ingen dokumenterad per-minut eller per-dag rate limit, men Exa har egna limits som inte exponeras.

**WebFetch-skillnaden:**

Claude Codes WebFetch bearbetar innehållet med en AI-modell och returnerar en sammanfattning baserad på en prompt. OpenCodes webfetch konverterar HTML till markdown och returnerar råinnehållet (5MB-gräns, 30s timeout, max 120s). OpenCodes variant ger mer kontroll men kräver att agenten själv tolkar innehållet (fler tokens).

**Bash-permissions:**

OpenCode stöder glob-mönster i permissions, likvärdigt med Claude Codes `--allowedTools`:

```json
{
  "permission": {
    "bash": {
      "*": "deny",
      "./add-item.sh *": "allow",
      "curl *": "allow"
    }
  }
}
```

Konfigureras i `opencode.json` (projekt eller globalt), inte som CLI-flagga. Sista matchande regeln vinner.

### 9.3 Kostnadsanalys

OpenCodes fördel: valfri modell från valfri provider. Kostnaden beror helt på vilken modell som används.

**Modelljämförelse för produktsökningsuppgiften (13k-25k input, 3k-4k output tokens per agent):**

| Modell | Input/MTok | Output/MTok | Kostnad/agent | 5 agenter/vecka | /månad |
|--------|-----------|-------------|---------------|-----------------|--------|
| Claude Haiku 4.5 (via CC) | $1.00 | $5.00 | $0.03-0.05 + WS | $0.15-0.25 + WS | $0.60-1.00 + WS |
| Claude Haiku 4.5 (via OC/Anthropic API) | $1.00 | $5.00 | $0.03-0.05 | $0.15-0.25 | $0.60-1.00 |
| GPT-4o-mini (via OC/OpenAI) | $0.15 | $0.60 | $0.004-0.008 | $0.02-0.04 | $0.08-0.16 |
| Gemini 2.5 Flash Lite (via OC/Google) | $0.10 | $0.40 | $0.003-0.005 | $0.015-0.025 | $0.06-0.10 |
| DeepSeek V3.2 (via OC/DeepSeek) | $0.28 | $0.42 | $0.005-0.011 | $0.03-0.05 | $0.10-0.22 |
| Gemini 2.5 Flash (via OC/Google) | $0.30 | $2.50 | $0.011-0.017 | $0.06-0.09 | $0.22-0.34 |
| Qwen3 Coder 480B (OpenRouter gratis) | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

CC = Claude Code, OC = OpenCode, WS = WebSearch-kostnad ($0.01/sökning, 2-3 per agent = $0.02-0.03). OpenCodes Exa-websearch har ingen explicit per-sökning-kostnad.

**Sammanfattning:**

- **GPT-4o-mini via OpenCode: 7-10x billigare** per agent jämfört med Haiku via Claude Code (exkl. WebSearch).
- **Gemini 2.5 Flash Lite: 10-15x billigare** per agent.
- **OpenRouter gratis (Qwen3 Coder 480B):** Noll kronor, men rate-limitad till 50 req/dag utan köpta credits (1000/dag med $10 credits). Okänd kvalitet för agentic web search tasks.
- **Claude Haiku via OpenCode vs Claude Code:** Samma tokenkostnad, men OpenCode slipper WebSearch-avgiften ($0.01/sökning) om Exa används istället.
- **Totalspara vid veckovis körning (5 agenter):** Claude Code Haiku $0.70-1.15/mån vs OpenCode GPT-4o-mini $0.08-0.16/mån. Skillnaden är marginell i absoluta tal, men procentuellt 7-10x.

**Evidenslucka:** Billigare modeller (GPT-4o-mini, Gemini Flash Lite, Qwen3) har sämre agent-reasoning än Haiku 4.5. Ett multi-step arbetsflöde (sök, hämta, verifiera, extrahera, kör skript) med 10-15 turns kan vara för krävande. Ingen empirisk data finns för just denna uppgift med dessa modeller.

### 9.4 Parallell exekvering

**Extern parallellism (separata processer):**

Samma bash-mönster som för `claude -p` fungerar med `opencode run`:

```bash
for search in "${SEARCHES[@]}"; do
  opencode run "Sök: $search" --model anthropic/claude-haiku-4-5 --format json &
done
wait
```

**Känd bugg:** Concurrent sessions i olika repos stör varandra (issue #4251, öppen). Agenter modifierar filer i fel repo. Symptom: "Modified Files"-panelen visar filer från andra sessioner.

**Intern parallellism (subagenter):**

OpenCodes Task-tool dispatchar subagenter, men de exekveras sekventiellt, inte parallellt (issue #14195). En orchestrator-agent som delegerar till 5 subagenter kör dem en i taget.

**Jämförelse med Claude Code:**

| Aspekt | Claude Code | OpenCode |
|--------|------------|----------|
| Parallella processer (extern) | Fungerar utan problem | Bugg: sessionsinterferens (#4251) |
| Subagenter (intern) | Ingen inbyggd subagent-funktionalitet | Finns men exekveras sekventiellt (#14195) |
| `opencode serve` pool | N/A | Möjligt, men en serve-instans = en session i taget |

**Praktisk konsekvens:** För produktsökningscaset med 5 parallella agenter är Claude Codes `claude -p` säkrare. OpenCodes sessionsinterferens (issue #4251) är en allvarlig risk om agenter ska skriva till samma workspace. Workaround: separata workspace-kopior per agent, men det komplicerar flock-baserad dedup via `add-item.sh`.

### 9.5 OpenCode + Claude-modeller (best of both worlds?)

OpenCode kan använda Claude-modeller via Anthropic API:

```json
{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      },
      "models": {
        "claude-haiku-4-5": {},
        "claude-sonnet-4-6": {}
      }
    }
  }
}
```

**Vad detta ger:**
- Claude Haiku/Sonnet-kvalitet för reasoning
- OpenCodes verktyg (inklusive gratis Exa-websearch istället för $0.01/sökning)
- OpenCodes agent-definitions (steps-begränsning, per-agent modellval, anpassade permissions)
- `opencode serve` för varm start vid upprepade körningar

**Vad det INTE ger:**
- `--max-budget-usd` (måste lösas externt)
- `--json-schema` för strukturerad output
- Problemfri parallellism (issue #4251 kvarstår)
- OpenCodes `opencode run` hänger vid 429 (issue #8203, kvarstår)

**Alternativ: OpenRouter som provider:**

```json
{
  "provider": {
    "openrouter": {
      "options": {
        "apiKey": "{env:OPENROUTER_API_KEY}"
      },
      "models": {
        "anthropic/claude-haiku-4-5": {},
        "openai/gpt-4o-mini": {},
        "google/gemini-2.5-flash": {}
      }
    }
  }
}
```

Ger tillgång till alla modeller via en nyckel. OpenRouter lägger på en liten avgift men ger automatisk failover mellan providers.

### 9.6 Mognad för automatiserad headless-drift

| Kriterium | Claude Code (`claude -p`) | OpenCode (`opencode run`) |
|-----------|--------------------------|--------------------------|
| Headless-läge | Stabil, väldokumenterad | Fungerar, sämre dokumenterad |
| Budget-begränsning | `--max-budget-usd` (inbyggd) | Saknas (måste lösas externt) |
| Turn-begränsning | `--max-turns` (CLI-flagga) | `steps` (kräver config-fil) |
| Strukturerad output | `--json-schema` (inbyggd) | Saknas (issue #10456) |
| WebSearch | $0.01/sökning, stabil | Exa AI, gratis, okänd stabilitet |
| 429-hantering | Fungerar (retry + exit) | Hänger sig (issue #8203, öppen) |
| Parallellism | Stabil | Sessionsinterferens (#4251) |
| Permissions i headless | `--allowedTools` (CLI-flagga) | Config-fil eller `OPENCODE_PERMISSION=deny` |
| Schemaläggning | Extern (cron/launchd) | Plugin (opencode-scheduler) |
| CI/CD-integration | `claude-code-action` (GitHub Actions) | Manuell (`opencode run` i CI-steg) |
| Modellflexibilitet | Bara Anthropic-modeller | 75+ providers, lokala modeller |
| Kostnad | $1/5 MTok (Haiku) + $0.01/WS | Valfri, ner till $0.10/0.40 MTok |

### 9.7 Rekommendation för produktsökningscaset

**BESLUT: OpenCode (`opencode run`) valdes.** Claude Code är backup.

Motivering:

1. **Modellfrihet.** OpenCode ger tillgång till GPT-4o-mini (7-10x billigare), Gemini Flash, och gratis modeller via OpenRouter. Möjlighet att testa vilken modell som ger bäst resultat för produktsökning.

2. **Gratis websearch.** Exa AI-integration utan per-sökning-kostnad sparar $0.02-0.03 per agent.

3. **`opencode serve` för warm start.** Vid hög körfrekvens slipper man kall start varje gång.

4. **Mikael vill testa OpenCode i produktion.**

Kända risker som accepteras:

- **Sessionsinterferens (#4251):** Workaround: separata arbetskataloger per agent, synkronisera via `add-item.sh` (flock).
- **429-häng (#8203):** Workaround: `timeout 120 opencode run "..."` som yttre tidsgräns.
- **Ingen `--max-budget-usd`:** Workaround: extern timeout + `steps`-begränsning i agent-config.

**Fallback:** Om OpenCode visar sig instabilt efter testning, byt till `claude -p` med Haiku. Orkestreringsscriptet designas för att stödja båda med en enkel flagga.

---

## Källor

- [Claude Code CLI reference (officiell)](https://code.claude.com/docs/en/cli-usage)
- [Claude Code headless mode (officiell)](https://code.claude.com/docs/en/headless)
- [Claude API pricing (officiell)](https://platform.claude.com/docs/en/about-claude/pricing)
- [Web search tool dokumentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Claude Code Agent Farm (GitHub)](https://github.com/Dicklesworthstone/claude_code_agent_farm)
- [Parallell körning av Claude Code (Ona)](https://ona.com/stories/parallelize-claude-code)
- [claude-code-action issue #690: WebSearch disabled](https://github.com/anthropics/claude-code-action/issues/690)
- [Claude Code WebFetch vs WebSearch (Mikhail Shilkov)](https://mikhail.io/2025/10/claude-code-web-tools/)
- [Claude Code headless tutorial (SFEIR Institute)](https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/cheatsheet/)
- [OpenCode CLI-referens (officiell)](https://opencode.ai/docs/cli/)
- [OpenCode Tools (officiell)](https://opencode.ai/docs/tools/)
- [OpenCode Providers (officiell)](https://opencode.ai/docs/providers/)
- [OpenCode Agents (officiell)](https://opencode.ai/docs/agents/)
- [OpenCode Permissions (officiell)](https://opencode.ai/docs/permissions/)
- [OpenCode Web Search & Fetch Tutorial](https://learnopencode.com/en/5-advanced/23-web-search)
- [OpenCode vs Claude Code (DataCamp)](https://www.datacamp.com/blog/opencode-vs-claude-code)
- [Claude Code vs OpenCode 2026 (Infralovers)](https://www.infralovers.com/blog/2026-01-29-claude-code-vs-opencode/)
- [OpenCode vs Claude Code (MorphLLM)](https://www.morphllm.com/comparisons/opencode-vs-claude-code)
- [opencode-scheduler plugin (GitHub)](https://github.com/different-ai/opencode-scheduler)
- [Issue #4251: Concurrent sessions interference](https://github.com/anomalyco/opencode/issues/4251)
- [Issue #14195: Sequential subtask execution](https://github.com/anomalyco/opencode/issues/14195)
- [Issue #8203: opencode run hänger vid 429](https://github.com/anomalyco/opencode/issues/8203)
- [Issue #10456: Structured output/JSON schema](https://github.com/anomalyco/opencode/issues/10456)
- [GPT-4o-mini pricing (OpenAI)](https://openai.com/api/pricing/)
- [Gemini 2.5 Flash pricing (Google)](https://ai.google.dev/gemini-api/docs/pricing)
- [DeepSeek V3.2 pricing](https://api-docs.deepseek.com/quick_start/pricing)
