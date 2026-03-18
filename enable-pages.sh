#!/bin/bash
set -e

echo "==> Ändrar repo till publikt (sidan är lösenordsskyddad)..."
gh repo edit Mikbol/vilgot-garderob --visibility public --accept-visibility-change-consequences

echo "==> Aktiverar GitHub Pages..."
gh api repos/Mikbol/vilgot-garderob/pages -X POST \
  -f "source[branch]=main" \
  -f "source[path]=/"

echo ""
echo "Klart! Sidan publiceras på:"
echo "https://mikbol.github.io/vilgot-garderob/"
echo "Lösenord: vilgotgotstyle"
echo ""
echo "Kan ta 1-2 min innan den syns."
