#!/bin/bash
# test-auto-discovery.sh - Verifierar hela auto-discovery-pipelinen
#
# Kör detta skript för att kontrollera att allt fungerar.
# Claude kan köra detta för att diagnostisera problem.
#
# Användning:
#   ./test-auto-discovery.sh              # Kör alla tester
#   ./test-auto-discovery.sh --offline    # Hoppa över OpenCode-tester (kräver ingen anslutning)

set -uo pipefail

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
OFFLINE=false
[[ "${1:-}" == "--offline" ]] && OFFLINE=true

# macOS saknar timeout (GNU coreutils). Använd gtimeout eller fallback utan timeout.
TIMEOUT_CMD=""
if command -v timeout >/dev/null 2>&1; then
    TIMEOUT_CMD="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
    TIMEOUT_CMD="gtimeout"
fi

run_with_timeout() {
    local secs="$1"; shift
    if [ -n "$TIMEOUT_CMD" ]; then
        $TIMEOUT_CMD "$secs" "$@"
    else
        "$@"
    fi
}

PASS=0
FAIL=0
SKIP=0

green() { echo -e "\033[0;32m  PASS: $1\033[0m"; PASS=$((PASS + 1)); }
red()   { echo -e "\033[0;31m  FAIL: $1\033[0m"; FAIL=$((FAIL + 1)); }
yellow(){ echo -e "\033[0;33m  SKIP: $1\033[0m"; SKIP=$((SKIP + 1)); }

expect_fail() {
    local desc="$1"; shift
    if "$@" >/dev/null 2>&1; then
        red "$desc (borde ha avvisats men lyckades)"
    else
        green "$desc"
    fi
}

expect_ok() {
    local desc="$1"; shift
    if "$@" >/dev/null 2>&1; then
        green "$desc"
    else
        red "$desc"
    fi
}

cd "$SITE_DIR"

echo "=== Fas 1: Filer och beroenden ==="

[ -f "index.html" ]           && green "index.html finns"           || red "index.html saknas"
[ -x "add-item.sh" ]          && green "add-item.sh körbar"         || red "add-item.sh saknas/ej körbar"
[ -f "json-helper.py" ]       && green "json-helper.py finns"       || red "json-helper.py saknas"
[ -f "opencode.json" ]        && green "opencode.json finns"        || red "opencode.json saknas"
[ -x "orchestrate.sh" ]       && green "orchestrate.sh körbar"      || red "orchestrate.sh saknas/ej körbar"
[ -f "agents/product-scout.md" ] && green "agents/product-scout.md finns" || red "agents/product-scout.md saknas"
[ -f ".gitignore" ]            && green ".gitignore finns"           || red ".gitignore saknas"
command -v python3 >/dev/null  && green "python3 tillgänglig"        || red "python3 saknas"
command -v curl >/dev/null     && green "curl tillgänglig"           || red "curl saknas"

# Verifiera att opencode.json är giltig JSON
if python3 -m json.tool opencode.json >/dev/null 2>&1; then
    green "opencode.json är giltig JSON"
else
    red "opencode.json är ogiltig JSON"
fi

echo ""
echo "=== Fas 2: add-item.sh validering (8 tester) ==="

expect_fail "Avvisar HTTP-URL" \
    ./add-item.sh add --name "Test Prod" --price "100 kr" --url "http://example.com/product/test" \
    --image-url "https://x.com/img.jpg" --brand "TestBrand" --no-commit

expect_fail "Avvisar sök-URL (google)" \
    ./add-item.sh add --name "Test Prod" --price "100 kr" --url "https://google.com/search?q=baby" \
    --image-url "https://x.com/img.jpg" --brand "TestBrand" --no-commit

expect_fail "Avvisar pris utan siffra" \
    ./add-item.sh add --name "Test Prod" --price "around thirty dollars" --url "https://example.com/product/test" \
    --image-url "https://x.com/img.jpg" --brand "TestBrand" --no-commit

expect_fail "Avvisar pris utan valuta" \
    ./add-item.sh add --name "Test Prod" --price "299" --url "https://example.com/product/test" \
    --image-url "https://x.com/img.jpg" --brand "TestBrand" --no-commit

expect_fail "Avvisar ogiltig sektion" \
    ./add-item.sh add --name "Test Prod" --price "100 kr" --url "https://example.com/product/test" \
    --image-url "https://x.com/img.jpg" --brand "TestBrand" --section "Påhittad Sektion" --no-commit

expect_fail "Avvisar ogiltigt storleksformat" \
    ./add-item.sh add --name "Test Prod" --price "100 kr" --url "https://example.com/product/test" \
    --image-url "https://x.com/img.jpg" --brand "TestBrand" --size "62" --no-commit

expect_fail "Avvisar saknad brand" \
    ./add-item.sh add --name "Test Prod" --price "100 kr" --url "https://example.com/product/test" \
    --image-url "https://x.com/img.jpg" --no-commit

# Sections-kommando
SECTIONS_OUTPUT=$(./add-item.sh sections 2>/dev/null)
if echo "$SECTIONS_OUTPUT" | grep -q "The Tiny Universe" && echo "$SECTIONS_OUTPUT" | grep -q "Childrensalon: Formal"; then
    green "sections listar alla giltiga sektioner"
else
    red "sections ger oväntad output"
fi

echo ""
echo "=== Fas 3: add-item.sh grundfunktioner ==="

COUNT_OUTPUT=$(./add-item.sh count 2>/dev/null)
if [[ "$COUNT_OUTPUT" =~ ^[0-9]+$ ]] && [ "$COUNT_OUTPUT" -ge 1 ]; then
    green "count returnerar antal ($COUNT_OUTPUT produkter)"
else
    red "count returnerar oväntat: '$COUNT_OUTPUT'"
fi

expect_ok "list fungerar" ./add-item.sh list

echo ""
echo "=== Fas 4: orchestrate.sh dry-run ==="

DRY_OUTPUT=$(./orchestrate.sh --dry-run 2>&1)
if echo "$DRY_OUTPUT" | grep -q "DRY RUN" && echo "$DRY_OUTPUT" | grep -q "Products before:"; then
    green "orchestrate.sh --dry-run fungerar"
else
    red "orchestrate.sh --dry-run misslyckades"
fi

DRY_SINGLE=$(./orchestrate.sh --dry-run --single 0 2>&1)
if echo "$DRY_SINGLE" | grep -q "Agent 0 starting"; then
    green "orchestrate.sh --dry-run --single 0 fungerar"
else
    red "orchestrate.sh --dry-run --single 0 misslyckades"
fi

echo ""
echo "=== Fas 5: OpenCode (kräver installation + Zen-anslutning) ==="

if [ "$OFFLINE" = true ]; then
    yellow "OpenCode-tester hoppade över (--offline)"
    yellow "OpenCode headless"
    yellow "OpenCode websearch"
    yellow "OpenCode kan köra add-item.sh count"
    yellow "OpenCode blockerar remove"
else
    if command -v opencode >/dev/null 2>&1; then
        green "opencode installerad ($(which opencode))"

        # Test: headless-körning
        HELLO_OUTPUT=$(run_with_timeout 30 opencode run "Svara med exakt texten: HELLO" 2>&1)
        if echo "$HELLO_OUTPUT" | grep -qi "hello"; then
            green "OpenCode headless fungerar"
        else
            red "OpenCode headless misslyckades: $HELLO_OUTPUT"
        fi

        # Test: websearch
        WS_OUTPUT=$(run_with_timeout 60 opencode run "Använd websearch för att söka 'baby tuxedo'. Skriv ut 1 URL du hittade." 2>&1)
        if echo "$WS_OUTPUT" | grep -qi "https://"; then
            green "OpenCode websearch fungerar"
        else
            red "OpenCode websearch misslyckades: $WS_OUTPUT"
        fi

        # Test: kan köra add-item.sh count
        COUNT_OC=$(run_with_timeout 30 opencode run "Kör kommandot: ./add-item.sh count" 2>&1)
        if echo "$COUNT_OC" | grep -qE "^[0-9]+$|: [0-9]+|is [0-9]+|count.*[0-9]+|68|69|7[0-9]"; then
            green "OpenCode kan köra add-item.sh count"
        else
            red "OpenCode kan inte köra add-item.sh count: $(echo "$COUNT_OC" | head -5)"
        fi

        # Test: blockerar remove
        REMOVE_OC=$(run_with_timeout 30 opencode run "Kör kommandot: ./add-item.sh remove --id 1" 2>&1)
        if echo "$REMOVE_OC" | grep -qi "deny\|denied\|permission\|not allowed\|blocked"; then
            green "OpenCode blockerar remove"
        else
            red "OpenCode blockerade INTE remove: $REMOVE_OC"
        fi
    else
        red "opencode inte installerad"
        yellow "OpenCode headless (kräver opencode)"
        yellow "OpenCode websearch (kräver opencode)"
        yellow "OpenCode kan köra add-item.sh count (kräver opencode)"
        yellow "OpenCode blockerar remove (kräver opencode)"
    fi
fi

echo ""
echo "=== Fas 6: launchd ==="

PLIST="$HOME/Library/LaunchAgents/local.vilgot-garderob.discovery.plist"
if [ -f "$PLIST" ]; then
    green "launchd plist installerad"
    if launchctl list 2>/dev/null | grep -q "vilgot-garderob"; then
        green "launchd jobb laddat"
    else
        red "launchd plist finns men jobbet är inte laddat (kör: launchctl load -w '$PLIST')"
    fi
else
    yellow "launchd plist inte installerad (steg 6 ej genomfört ännu)"
fi

# Sammanfattning
echo ""
echo "================================"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  SKIP: $SKIP"
echo "================================"

if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo "Åtgärd: fixa FAIL-raderna ovan. Kör sedan detta skript igen."
    exit 1
else
    echo ""
    if [ "$SKIP" -gt 0 ]; then
        echo "Alla körda tester OK. $SKIP tester hoppades över."
    else
        echo "Alla tester OK!"
    fi
    exit 0
fi
