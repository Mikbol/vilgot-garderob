#!/bin/bash
set -e

REPO_NAME="vilgot-garderob"
GH_USER="Mikbol"
DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$DIR"

echo "==> Skapar lokalt git-repo..."
git init
git checkout -b main

echo "==> Committar filer..."
git add index.html
git commit -m "Vilgots Garderob lookbook"

echo "==> Skapar privat GitHub-repo: $GH_USER/$REPO_NAME..."
gh repo create "$REPO_NAME" --private --source=. --push

echo "==> Aktiverar GitHub Pages..."
sleep 2
gh api "repos/$GH_USER/$REPO_NAME/pages" -X POST \
  -f "source[branch]=main" \
  -f "source[path]=/" \
  --silent 2>/dev/null || echo "    (Pages kanske redan är aktiverat)"

echo ""
echo "==> Klart!"
echo "    URL: https://${GH_USER,,}.github.io/$REPO_NAME/"
echo "    Lösenord: vilgotgotstyle"
echo ""
echo "    Det kan ta 1-2 minuter innan sidan syns."
