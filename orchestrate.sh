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

# macOS saknar timeout (GNU coreutils). Använd gtimeout eller fallback.
TIMEOUT_BIN=""
if command -v timeout >/dev/null 2>&1; then
    TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
    TIMEOUT_BIN="gtimeout"
fi
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

  if [ -n "$TIMEOUT_BIN" ]; then
    $TIMEOUT_BIN "$TIMEOUT_SECS" opencode run "$prompt" \
      $MODEL_FLAG \
      >> "$log_file" 2>&1 || exit_code=$?
  else
    opencode run "$prompt" \
      $MODEL_FLAG \
      >> "$log_file" 2>&1 || exit_code=$?
  fi

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
