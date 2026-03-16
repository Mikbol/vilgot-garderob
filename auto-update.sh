#!/bin/bash
# auto-update.sh - Automatisk uppdatering av Vilgots Garderob
# Körs via cron/launchd. Anropar Claude Code för att söka nya produkter.
#
# Användning:
#   chmod +x auto-update.sh
#   # Manuellt test:
#   ./auto-update.sh
#
# Cron (1x/vecka, söndag kl 10):
#   0 10 * * 0 cd ~/AI-Assistent/vilgot-kläder/site && ./auto-update.sh >> auto-update.log 2>&1
#
# macOS launchd: se companion plist-fil

set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$SITE_DIR/auto-update.log"
DATE=$(date '+%Y-%m-%d %H:%M')

echo "[$DATE] Starting auto-update..." >> "$LOG_FILE"

cd "$SITE_DIR"

# Anropa Claude Code i headless-mode
claude -p "
Du jobbar i $SITE_DIR.

UPPGIFT: Hitta 3-5 NYA gentleman-babykläder (kostym, smoking, fluga, hängslen, väst, slips) och lägg till dem på sidan.

REGLER:
1. Sök produkter från: Childrensalon, Lilax, Feltman Brothers, The Tiny Universe, Lulu Babe, Cuddle Sleep Dream, ONEA Kids, Jacadi, eller andra kvalitetsmärken.
2. Ladda ner produktbilder till img/ (verifiera att de är riktiga bilder, inte HTML).
3. Lägg till nya produktkort i index.html i rätt sektion. Följ exakt samma HTML-struktur som befintliga kort (card-carousel, buy-btn osv).
4. INGA DUBLETTER - kolla att produktnamn/bild inte redan finns i index.html.
5. Uppdatera produkträknaren i headern.
6. Testa att alla nya bilder är giltiga.
7. Commita och pusha:
   git add img/ index.html
   git commit -m 'auto: add new gentleman baby clothes'
   git push origin main
8. Bara formella/dressade babykläder. Inga vardagskläder.
" 2>> "$LOG_FILE"

echo "[$DATE] Auto-update complete." >> "$LOG_FILE"
