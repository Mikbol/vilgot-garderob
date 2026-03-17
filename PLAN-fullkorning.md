# Plan: Fullkörning alla 5 agenter

Skapad: 2026-03-17

## Mål

Köra alla 5 OpenCode-agenter, verifiera resultatet, pusha till live-sajt. Allt som kan gå fel ska vara identifierat och hanterat innan körningen startar.

## Kända problem från förra körningen (2026-03-17 15:50)

| # | Problem | Effekt | Antal agenter drabbade |
|---|---------|--------|----------------------|
| 1 | Dollar-pris i dubbla citattecken | `"$44.99"` → shell expanderar `$44` → `.99` → pris avvisas | 5/5 |
| 2 | mktemp-kollision | `/tmp/vg-product-XXXXXX.json` kan inte skapas → add blockeras | 5/5 |
| 3 | Ingen timeout | Agenter körde 4-25 min istället för max 3 min | 5/5 |
| 4 | Föräldralösa bilder | Bild nedladdad men add misslyckades → bild kvar utan produkt | 32 bilder |

## Fixar att implementera

### Fix 1: Dollar-pris (KRITISK)

**Orsak:** OpenCode kör bash-kommandon genom en shell. `--price "$44.99"` expanderar `$44` till tom sträng. Agenten har försökt enkla citattecken men OpenCode skickar dem inkonsekvent.

**Fix:** Ändra agent-prompten (`agents/product-scout.md`) att instruera:
- Skriv ALLTID valutakod FÖRE priset: `USD 44.99`, `GBP 78`, `EUR 45`
- Skriv ALDRIG `$44.99`, `£78`, `€45` (symboler expanderas/tolkas av shell)
- Undantag: `kr` fungerar (ingen shell-expansion)

**Verifiering:**
```bash
./add-item.sh add --name "Test" --price "USD 44.99" --url "https://example.com/product/test" \
  --image-url "https://example.com/img.jpg" --brand "Test" --no-commit --dry-run
# Förväntat: [DRY RUN] Would add product (inte ERROR)
```

### Fix 2: mktemp (FIXAD)

Redan fixad: 8 X:ar istället för 6, inget `.json`-suffix.

**Verifiering:**
```bash
# Skapa 10 temp-filer snabbt efter varandra, alla ska lyckas
for i in $(seq 1 10); do mktemp /tmp/vg-product-XXXXXXXX; done
# Rensa: rm -f /tmp/vg-product-*
```

### Fix 3: Timeout (FIXAD)

Redan fixad: `dg_timeout` som primär.

**Verifiering:**
```bash
dg_timeout 2 sleep 10
echo "Exit efter $SECONDS sekunder"
# Förväntat: ~2 sekunder, inte 10
```

### Fix 4: Föräldralösa bilder

Inte en bugg att fixa, utan en städrutin. `diagnose-run.sh` rapporterar antal. Städning:
```bash
git status --short | grep '^?? img/' | awk '{print $2}' | xargs rm -f
```

## Förutsättningar (alla måste vara sanna innan körning)

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site

# 1. Inga kvarvarande temp-filer
ls /tmp/vg-product-* /tmp/vg-img-* 2>/dev/null && echo "RENSA FÖRST" || echo "OK"

# 2. Inget lock
ls -d .add-item.lock.d 2>/dev/null && echo "RENSA FÖRST" || echo "OK"

# 3. dg_timeout finns
command -v dg_timeout && echo "OK" || echo "SAKNAS"

# 4. OpenCode fungerar
opencode run "Svara: OK" 2>&1 | grep -qi "ok" && echo "OK" || echo "FEL"

# 5. test-auto-discovery.sh passerar
./test-auto-discovery.sh
# Förväntat: alla PASS

# 6. Inga opencode-processer igång
ps aux | grep "opencode run" | grep -v grep && echo "DÖDA FÖRST" || echo "OK"
```

## Exekvering

### Steg 1: Implementera dollar-pris-fix

Ändra `agents/product-scout.md`:
- Steg 2 (Verifiera): Lägg till instruktion om valutakoder
- Steg 5 (Lägg till): Ändra exemplet till `USD 44.99`
- Regler: Lägg till regel om valutakoder

### Steg 2: Verifiera alla förutsättningar

Kör alla 6 förutsättningscheckar ovan. Alla måste ge "OK".

### Steg 3: Kör alla 5 agenter

```bash
BEFORE=$(./add-item.sh count)
./orchestrate.sh --no-push
AFTER=$(./add-item.sh count)
echo "Före: $BEFORE, Efter: $AFTER, Nya: $((AFTER - BEFORE))"
```

Förväntat: varje agent max 3 min (180s). Total tid: 5-15 min.

### Steg 4: Diagnostisera

```bash
./diagnose-run.sh
```

**Pass (alla dessa):**
- 0 mktemp-kollisioner
- 0 dollar-pris-buggar
- Alla agenter använde websearch (≥1 sökning per agent)
- Alla agenter använde webfetch (≥1 per agent)
- Inga timeout (alla under 180s)
- Minst 1 produkt tillagd totalt (om 0: undersök varför, alla kan vara duplikat)

**Om fail:** Läs diagnosen, identifiera felet, fixa, rensa temp+lock, kör om.

### Steg 5: Städa föräldralösa bilder

```bash
ORPHANS=$(git status --short | grep '^?? img/' | wc -l)
echo "Föräldralösa bilder: $ORPHANS"
# Om > 0:
git status --short | grep '^?? img/' | awk '{print $2}' | xargs rm -f
```

### Steg 6: Pusha

```bash
git push origin main
```

### Steg 7: Verifiera live-sajt

Vänta tills Pages är byggt:
```bash
gh api repos/Mikbol/vilgot-garderob/pages --jq '.status'
# Förväntat: "built"
```

Verifiera med WebFetch:
- Antal produkter matchar `./add-item.sh count`
- Nya produkter syns med rätt namn och pris

Verifiera med Chrome (om anslutet):
- JavaScript: scrolla hela sidan, kolla `img.complete && img.naturalWidth > 0` per bild
- JavaScript: kolla att nya köp-länkar pekar på produktsidor (inte /collections/)
- Screenshot: visuellt bekräfta att nya produktbilder visar rätt plagg

Verifiera bilder med curl:
```bash
# För varje ny bild:
curl -sL -o /dev/null -w 'HTTP %{http_code}: FILNAMN\n' "https://mikbol.github.io/vilgot-garderob/img/FILNAMN"
```

**Pass:** Allt matchar, alla bilder HTTP 200, inga trasiga bilder, inga samlingslänkar bland nya produkter.

### Steg 8: Uppdatera dokument

- PLAN-auto-discovery.md: markera steg 12 (full körning) som klart, uppdatera acceptanskriterier
- STATUS.md: uppdatera antal produkter, status, testresultat
- Denna plan: markera som genomförd

## Vad kan fortfarande gå fel

| Risk | Sannolikhet | Hantering |
|------|-------------|-----------|
| Zen rate limit under körning | Medel | Agenten timear ut efter 3 min, nästa agent startar. Diagnosen visar det. |
| Webfetch returnerar skräp-HTML | Låg | Agenten extraherar fel data → add-item.sh avvisar ogiltigt format |
| Agent lägger produkt i fel sektion | Medel | Acceptabelt. Kan korrigeras manuellt med `remove` + `add` |
| Agent lägger till irrelevant produkt (inte gentleman) | Låg | Agent-prompten specificerar tydligt. Om det händer: `./add-item.sh remove --id N` |
| GitHub Pages bygger inte | Låg | Kolla `gh api .../pages`, vänta, kolla igen |
| Agent hittar 0 produkter | Medel (många duplikat) | Acceptabelt om diagnosen visar att den sökte ordentligt |
