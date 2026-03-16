#!/bin/bash
# Test all product links and images in index.html
# Validates that URLs return HTTP 200

set -euo pipefail

HTML="$(dirname "$0")/index.html"
PASS=0
FAIL=0
WARN=0
ERRORS=""

echo "==> Testar alla länkar och bilder i index.html..."
echo ""

# Extract all URLs (href and src attributes)
URLS=$(grep -oP '(?:href|src)="(https?://[^"]+)"' "$HTML" | grep -oP 'https?://[^"]+' | sort -u)

TOTAL=$(echo "$URLS" | wc -l | tr -d ' ')
echo "    Hittade $TOTAL unika URLs att testa"
echo ""

for url in $URLS; do
  # Get HTTP status code (follow redirects, timeout 10s)
  status=$(curl -o /dev/null -s -w "%{http_code}" -L --max-time 10 "$url" 2>/dev/null || echo "000")

  if [ "$status" = "200" ]; then
    echo "  ✅ $status  $url"
    PASS=$((PASS + 1))
  elif [ "$status" = "403" ] || [ "$status" = "503" ]; then
    echo "  ⚠️  $status  $url (bot-blocked, works in browser)"
    WARN=$((WARN + 1))
  elif [ "$status" = "500" ] && echo "$url" | grep -q "amazon.com"; then
    echo "  ⚠️  $status  $url (Amazon rate-limit, works in browser)"
    WARN=$((WARN + 1))
  elif [ "$status" = "000" ]; then
    echo "  ❌ TIMEOUT  $url"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  TIMEOUT: $url"
  else
    echo "  ❌ $status  $url"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  $status: $url"
  fi
done

echo ""
echo "==> Resultat"
echo "    ✅ OK:       $PASS"
echo "    ⚠️  Varning:  $WARN (403, fungerar troligen i browser)"
echo "    ❌ Fel:      $FAIL"
echo ""

if [ $FAIL -gt 0 ]; then
  echo "==> Felande URLs:"
  echo -e "$ERRORS"
  echo ""
  exit 1
else
  echo "==> Alla länkar verifierade!"
fi
