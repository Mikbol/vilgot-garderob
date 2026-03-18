# Plan: Fullkörning alla 5 agenter

Skapad: 2026-03-17

## Mål

Köra alla 5 OpenCode-agenter med fungerande timeout, verifiera resultatet på live-sajten, installera launchd-schema. Alla steg körs autonomt av Claude utan att fråga Mikael, förutom steg som explicit markeras "FRÅGA MIKAEL".

## Kända problem från förra körningen (2026-03-17 15:50)

5 agenter körde utan timeout (4-25 min/agent). 0 produkter lades till. Orsaker:

| # | Problem | Drabbade | Status |
|---|---------|----------|--------|
| 1 | Dollar-pris: `"$44.99"` → shell expanderar `$44` → `.99` | 5/5 agenter | Fixas i steg 1 |
| 2 | mktemp-kollision: `.json`-suffix → kan ej skapa temp-fil | 5/5 agenter | Fixad (8 X:ar, inget suffix) |
| 3 | Ingen timeout: dg_timeout saknades i skriptet | 5/5 agenter | Fixad (dg_timeout som primär) |
| 4 | Föräldralösa bilder: bild nedladdad men add misslyckades | 32 bilder | Städade |

## Steg 1: Fixa dollar-pris i agent-prompten

**Vad:** Ändra `agents/product-scout.md` så agenten skriver valutakoder (`USD 44.99`) istället för symboler (`$44.99`). Shell expanderar `$` i dubbla citattecken. Valutakoder har inga specialtecken.

**Exakt ändring i Steg 2 (Verifiera):**
- Ändra exemplet `"$27.99"` till `"USD 27.99"`
- Ändra `"£78"` till `"GBP 78"`
- Lägg till: "Använd ALLTID valutakod (USD, GBP, EUR, AUD, CAD), ALDRIG symbol ($, £, €). Symboler förstörs av shell-expansion."

**Exakt ändring i Steg 5 (Lägg till):**
- Ändra `--price "PRIS"` exemplet till `--price "USD 44.99"`

**Exakt ändring i Regler:**
- Ändra regel 5 till: "Kopiera pris EXAKT men ersätt valutasymboler med koder: $ → USD, £ → GBP, € → EUR. Exempel: priset $27.99 skrivs som 'USD 27.99'. Symboler förstörs av shell. kr fungerar som det är."

**Verifiering efter ändring:**
```bash
./add-item.sh add --name "Test Prod" --price "USD 44.99" --url "https://example.com/product/test" \
  --image-url "https://example.com/img.jpg" --brand "TestBrand" --no-commit --dry-run
```
Pass: output innehåller `[DRY RUN] Would add product`. Fail: `ERROR`.

**Tid:** 2 min.

## Steg 2: Testa att dollar-pris-fixen fungerar med OpenCode

Prompten är uppdaterad, men fungerar det i praktiken? Testa att OpenCode skickar rätt format:

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site
opencode run "Kör kommandot: ./add-item.sh add --name 'Testprodukt' --price 'USD 29.99' --url 'https://example.com/product/test123' --image-url 'https://example.com/img.jpg' --brand 'TestBrand' --no-commit --dry-run"
```

Pass: output innehåller `[DRY RUN] Would add product` (priset gick igenom valideringen).
Fail: `ERROR` om OpenCode fortfarande expanderar något.

Om fail: undersök exakt vad OpenCode skickar. Alternativ fix: ändra add-item.sh pris-validering att acceptera rena nummer + anta USD.

**Tid:** 1 min.

## Steg 3: Verifiera förutsättningar

Kör varje check. ALLA måste ge OK. Om någon ger FAIL: fixa innan nästa steg.

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site

# 1. Temp-filer
ls /tmp/vg-product-* /tmp/vg-img-* 2>/dev/null && echo "FAIL: rensa temp" || echo "OK: inga temp"

# 2. Lock
ls -d .add-item.lock.d 2>/dev/null && echo "FAIL: rensa lock" || echo "OK: inget lock"

# 3. Timeout
command -v dg_timeout >/dev/null && echo "OK: dg_timeout finns" || echo "FAIL: dg_timeout saknas"

# 4. Inga opencode-processer
ps aux | grep "opencode run" | grep -v grep >/dev/null && echo "FAIL: döda processer" || echo "OK: inga processer"

# 5. test-auto-discovery.sh
./test-auto-discovery.sh
```

Pass: alla OK + test-auto-discovery.sh 0 FAIL.

**Tid:** 2 min.

## Steg 4: Kör alla 5 agenter

```bash
BEFORE=$(./add-item.sh count)
echo "Produkter före: $BEFORE"
./orchestrate.sh --no-push
AFTER=$(./add-item.sh count)
echo "Produkter efter: $AFTER, Nya: $((AFTER - BEFORE))"
```

`--no-push` tills steg 7 verifierat resultatet. Varje agent har 180s timeout via `dg_timeout`.

**Tid:** 5-15 min (5 agenter × 1-3 min). Om en agent timear ut loggas det, nästa startar.

## Steg 5: Diagnostisera

```bash
./diagnose-run.sh
```

**Pass (alla dessa):**
- 0 mktemp-kollisioner bland alla agenter
- 0 dollar-pris-buggar bland alla agenter
- Varje agent har ≥1 websearch OCH ≥1 webfetch (annars sökte den inte)
- Alla agenter under 180s (timeout fungerade)
- ≥1 produkt tillagd totalt

**Godkänt med notering:** 0 nya produkter OM diagnosen visar att varje agent sökte (≥1 websearch + ≥1 webfetch) och alla hittade produkter var duplikat eller bilder blockerades (HTTP 403). Notera i dokumentationen att körningen fungerade tekniskt men inte hittade nya produkter.

**Fail:**
- mktemp-kollision → temp-filer kvar. Rensa `/tmp/vg-product-* /tmp/vg-img-*`, kör om från steg 3.
- Dollar-pris-bugg → promptfixen fungerade inte. Undersök logg, ändra prompt eller add-item.sh, kör om från steg 1.
- Agent med 0 websearch → agenten startade men sökte inte. Kontrollera Zen-anslutning, modell, rate limits.
- Timeout → agenten var för långsam. Acceptabelt om den hann söka och felet bara var att den tog tid. Inte acceptabelt om den hängde utan att göra något (kolla loggen).

**Tid:** 1 min.

## Steg 6: Städa föräldralösa bilder

```bash
ORPHANS=$(git status --short | grep -c '^?? img/' || true)
echo "Föräldralösa bilder: ${ORPHANS:-0}"
```

Om > 0: ta bort dem.
```bash
git status --short | grep '^?? img/' | awk '{print $2}' | xargs rm -f
```

**Tid:** 1 min.

## Steg 7: Verifiera lokalt och pusha

**7a. Kolla git-status:**
```bash
git status
git log --oneline -5
```

Förväntat: en commit "auto: +N gentleman baby clothes" (om produkter lades till), inga otrackade filer i img/.

**7b. Pusha:**
```bash
git push origin main
```

**7c. Vänta på Pages-build:**
```bash
# Kör tills status = "built" (max 5 försök, 30s mellanrum)
for i in 1 2 3 4 5; do
  STATUS=$(gh api repos/Mikbol/vilgot-garderob/pages --jq '.status')
  echo "Försök $i: $STATUS"
  [ "$STATUS" = "built" ] && break
  sleep 30
done
```

**Tid:** 1-3 min.

## Steg 8: Verifiera live-sajt

Tre metoder. Alla obligatoriska.

**8a. WebFetch (dataverifiering):**

WebFetch mot `https://mikbol.github.io/vilgot-garderob/`. Kontrollera:
- Antal produkter = `./add-item.sh count`
- Nya produkter finns med rätt namn och pris

**8b. Chrome (visuell + pixelverifiering):**

Om Chrome-extension är ansluten:
1. Navigera till sajten
2. JavaScript: scrolla hela sidan, sedan kolla `img.complete && img.naturalWidth > 0` per bild
3. JavaScript: hitta köp-länkar bland nya produkter som pekar på /collections/ istället för /products/
4. scroll_to + screenshot per ny produkt: bekräfta att bilden visar ett faktiskt babyklädesplagg

Om Chrome INTE är ansluten: dokumentera att visuell verifiering inte gjordes. WebFetch + curl räcker för att bekräfta att data är korrekt, men visuell bekräftelse saknas.

**8c. curl (bildverifiering):**

```bash
# Lista nya bilder (tillagda sedan senaste commit före körningen)
git diff --name-only HEAD~1 -- img/ | while read f; do
  curl -sL -o /dev/null -w "HTTP %{http_code}: $f\n" "https://mikbol.github.io/vilgot-garderob/$f"
done
```

Pass: alla HTTP 200.

**Tid:** 3 min.

## Steg 9: Uppdatera dokument

- `plan-auto-discovery.md`: markera steg 12 (full körning) som ✅, uppdatera acceptanskriterier med resultat
- `STATUS.md`: uppdatera antal produkter, testresultat, status
- `plan-fullkorning.md`: skriv resultat i botten av filen
- `index.md` (workspace): uppdatera om beskrivningen ändrats

**Tid:** 2 min.

## Steg 10: Installera launchd

**Vad:** Schemalägg veckovis körning (söndagar kl 10) via macOS launchd.

**10a. Skapa plist-filen:**
```bash
cat > ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>local.vilgot-garderob.discovery</string>
    <key>Program</key>
    <string>/Users/bolm/AI-Assistent/vilgot-kläder/site/orchestrate.sh</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>0</integer>
        <key>Hour</key>
        <integer>10</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/vilgot-discovery.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/vilgot-discovery.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:/Users/bolm/.local/bin</string>
        <key>OPENCODE_ENABLE_EXA</key>
        <string>true</string>
        <key>HOME</key>
        <string>/Users/bolm</string>
    </dict>
</dict>
</plist>
PLIST
```

Notera: PATH inkluderar `~/.local/bin` för `dg_timeout`. HOME satt explicit (launchd sätter det inte alltid).

**10b. Ladda jobbet:**
```bash
launchctl load -w ~/Library/LaunchAgents/local.vilgot-garderob.discovery.plist
```

**10c. Verifiera:**
```bash
launchctl list | grep vilgot
```
Pass: en rad visas med label `local.vilgot-garderob.discovery`.

**FRÅGA MIKAEL:** Innan steg 10 genomförs. "Ska jag installera launchd-schemat nu? Det kör orchestrate.sh varje söndag kl 10 och pushar automatiskt."

**Tid:** 2 min.

## Rollback

Om steg 7 pushar och live-sajten visar fel:

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site

# Hitta commit innan körningen
git log --oneline -5
# Identifiera commit-hash FÖRE "auto: +N gentleman baby clothes"

# Ångra
git revert HEAD
git push origin main
```

Om flera commits behöver ångras: `git revert HEAD~N..HEAD` (ersätt N med antal).

Föräldralösa bilder som redan pushats: `git rm img/FILNAMN && git commit && git push`.

## Total tid

| Steg | Tid |
|------|-----|
| 1. Dollar-pris-fix | 2 min |
| 2. Testa fix med OpenCode | 1 min |
| 3. Förutsättningar | 2 min |
| 4. Kör 5 agenter | 5-15 min |
| 5. Diagnostisera | 1 min |
| 6. Städa bilder | 1 min |
| 7. Push + Pages-build | 1-3 min |
| 8. Verifiera live | 3 min |
| 9. Dokument | 2 min |
| 10. launchd | 2 min |
| **Total** | **20-32 min** |

## Resultat (2026-03-17 19:13)

Körningen genomförd enligt plan. Alla steg passerade.

| Steg | Resultat |
|------|----------|
| 1. Dollar-pris-fix | ✅ Prompt ändrad, `USD 44.99` passerar validering |
| 2. Test med OpenCode | ✅ `USD 29.99` gick igenom via OpenCode |
| 3. Förutsättningar | ✅ Alla OK, 22/22 PASS offline |
| 4. Kör 5 agenter | ✅ 5 nya produkter, 15 min, alla timeout 180s |
| 5. Diagnostisera | ✅ 0 mktemp, 0 dollar-pris, alla websearch+webfetch, 1 fel (bild utan https, korrekt avvisad) |
| 6. Städa bilder | ✅ 0 föräldralösa |
| 7. Push + Pages | ✅ Pushat, Pages status "built" |
| 8. Live-verifiering | ✅ WebFetch: 76 produkter. curl: 5 nya bilder HTTP 200. Chrome: ej ansluten (noterat som lucka). |
| 9. Dokument | ✅ plan-auto-discovery.md + STATUS.md uppdaterade |
| 10. launchd | ✅ Installerad, dagligen kl 05:45 |

### Nya produkter tillagda

| Agent | Produkt | Pris | Brand |
|-------|---------|------|-------|
| 0 | Black Formal Tuxedo Set (3M-14Y) | 735.00 kr | Blessed Celebration |
| 1 | Bowtie Suspender Baby Boy Outfit | 567.11 kr | Momorii |
| 1 | Short Tuxedo Bow Tie Rompers | USD 425.00 | MIKI HOUSE Baby |
| 2 | Nautical Knitted Sailor Set | 471.00 kr | Ryan and Remi |
| 4 | Fendi Baby Boys Blue & White Ceremony Romper | 7255.00 kr | Fendi |

### Luckor

- Chrome var ej ansluten vid live-verifiering. Visuell pixelverifiering av nya bilder gjordes inte. WebFetch + curl bekräftar att data och bilder finns, men inte att bilderna visar rätt plagg.
