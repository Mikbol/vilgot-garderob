#!/bin/bash
set -e
cd "$(dirname "$0")"
git add index.html json-helper.py add-item.sh test-links.sh img/ PLAN-v2.md
git commit -m "v3: JSON-driven rendering, add-item.sh for agent integration"
git push
echo ""
echo "Uppdaterat! Ge det 1-2 min, sedan ladda om:"
echo "https://mikbol.github.io/vilgot-garderob/"
