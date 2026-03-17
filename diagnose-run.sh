#!/bin/bash
# diagnose-run.sh - Analysera agentloggar efter en orchestrate.sh-körning
#
# Användning:
#   ./diagnose-run.sh                    # Analysera senaste körningen
#   ./diagnose-run.sh 2026-03-17_155016  # Analysera specifik körning (datum_tid-prefix)
#
# Claude ska köra detta efter varje orchestrate.sh-körning för att
# identifiera problem utan att manuellt grotta i loggar.

set -uo pipefail

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SITE_DIR/logs"

# Hitta loggar
PREFIX="${1:-}"
if [ -z "$PREFIX" ]; then
    # Senaste körningen: hitta senaste datum-prefix
    PREFIX=$(ls "$LOG_DIR"/*.log 2>/dev/null | sed 's/.*\///' | sed 's/_agent-.*//' | sort -u | tail -1)
    if [ -z "$PREFIX" ]; then
        echo "Inga loggar hittade i $LOG_DIR"
        exit 1
    fi
fi

LOGS=("$LOG_DIR"/${PREFIX}_agent-*.log)
if [ ! -f "${LOGS[0]}" ]; then
    echo "Inga loggar matchar prefix: $PREFIX"
    exit 1
fi

echo "=== Diagnos: $PREFIX ==="
echo "Loggar: ${#LOGS[@]} agenter"
echo ""

TOTAL_ADDED=0
TOTAL_ERRORS=0
TOTAL_DUPES=0
TOTAL_TIMEOUT=0

for log in "${LOGS[@]}"; do
    AGENT=$(basename "$log" | sed 's/.*agent-//' | sed 's/\.log//')
    echo "--- Agent $AGENT ---"

    # Strippa ANSI-koder för pålitlig grep
    CLEAN=$(sed 's/\x1b\[[0-9;]*m//g' "$log")

    # Tid
    TIMING=$(echo "$CLEAN" | grep -E "OK after|TIMEOUT|FAILED" | tail -1)
    echo "  Status: ${TIMING:-OKÄND}"

    # Websearch
    WS_COUNT=$(echo "$CLEAN" | grep -c "Web Search\|WebSearch\|Exa" || true); WS_COUNT=${WS_COUNT:-0}
    echo "  Websearch: $WS_COUNT sökningar"

    # Webfetch
    WF_COUNT=$(echo "$CLEAN" | grep -c "WebFetch" || true); WF_COUNT=${WF_COUNT:-0}
    echo "  Webfetch: $WF_COUNT sidbesök"

    # Duplikat
    DUPES=$(echo "$CLEAN" | grep -c '"exists": true' || true); DUPES=${DUPES:-0}
    echo "  Duplikat: $DUPES"
    TOTAL_DUPES=$((TOTAL_DUPES + DUPES))

    # Tillagda
    ADDED=$(echo "$CLEAN" | grep -c '"status": "added"' || true); ADDED=${ADDED:-0}
    echo "  Tillagda: $ADDED"
    TOTAL_ADDED=$((TOTAL_ADDED + ADDED))

    # Fel
    ERRORS=$(echo "$CLEAN" | grep -c "ERROR:" || true); ERRORS=${ERRORS:-0}
    echo "  Fel: $ERRORS"
    TOTAL_ERRORS=$((TOTAL_ERRORS + ERRORS))

    # Visa specifika fel
    if [ "$ERRORS" -gt 0 ]; then
        echo "  Felmeddelanden:"
        echo "$CLEAN" | grep "ERROR:" | sort -u | while read -r line; do
            echo "    $line"
        done
    fi

    # mktemp-problem
    MKTEMP=$(echo "$CLEAN" | grep -c "mktemp.*failed\|mkstemp" || true); MKTEMP=${MKTEMP:-0}
    if [ "$MKTEMP" -gt 0 ]; then
        echo "  ⚠ mktemp-kollision: $MKTEMP gånger"
    fi

    # Permission denied
    PERMDENY=$(echo "$CLEAN" | grep -c "PermissionDeniedError" || true); PERMDENY=${PERMDENY:-0}
    if [ "$PERMDENY" -gt 0 ]; then
        echo "  ⚠ Permission denied: $PERMDENY (agenten försökte köra blockerat kommando)"
    fi

    # Dollar-pris-problem
    DOLLARBUG=$(echo "$CLEAN" | grep -c "Price must contain.*'\." || true); DOLLARBUG=${DOLLARBUG:-0}
    if [ "$DOLLARBUG" -gt 0 ]; then
        echo "  ⚠ Dollar-pris-bugg: $DOLLARBUG (shell expanderade \$-pris)"
    fi

    echo ""
done

# Kolla föräldralösa bilder
ORPHANS=$(cd "$SITE_DIR" && git status --short 2>/dev/null | grep -c '^?? img/' || true)
ORPHANS=${ORPHANS:-0}

echo "=== Sammanfattning ==="
echo "  Tillagda produkter: $TOTAL_ADDED"
echo "  Duplikat (hoppade över): $TOTAL_DUPES"
echo "  Fel totalt: $TOTAL_ERRORS"
echo "  Föräldralösa bilder: $ORPHANS"

if [ "$ORPHANS" -gt 0 ]; then
    echo ""
    echo "  Städa föräldralösa bilder:"
    echo "    git status --short | grep '^?? img/' | awk '{print \$2}' | xargs rm -f"
fi

if [ "$TOTAL_ERRORS" -gt 0 ] && [ "$TOTAL_ADDED" -eq 0 ]; then
    echo ""
    echo "  ⚠ Inga produkter lades till trots att agenter körde."
    echo "    Vanliga orsaker: mktemp-kollision, dollar-pris-bugg, bildnedladdning blockerad."
    echo "    Kör: rm -f /tmp/vg-product-* /tmp/vg-img-*"
fi

echo ""
