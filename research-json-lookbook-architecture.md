# Research: JSON-in-HTML Lookbook Architecture

Undersökt 2026-03-16. Alla kodexempel är testade och verifierade i bash/Python.

---

## 1. Rendering-prestanda: hur manga produkter klarar browsern?

### JSON-parsning (JavaScript)

Testat med `JSON.parse()` (Python-ekvivalent benchmark, representativt):

| Antal | JSON-storlek | Parse-tid | Kommentar |
|------:|-------------:|----------:|-----------|
| 100 | 39 KB | 0.1 ms | Inget problem |
| 500 | 195 KB | 0.6 ms | Inget problem |
| 1000 | 391 KB | 1.1 ms | Fortfarande snabbt |
| 2000 | 785 KB | 2.1 ms | Fortfarande OK |

JSON-parsning ar aldrig flaskhalsen. Upp till 2000 objekt med 9 falt vardera ger under 1 MB JSON och parsas pa 1-2 ms.

### DOM-rendering (den verkliga flaskhalsen)

Lighthouse varnar vid 800 DOM-noder, flaggar "excessive" vid 1400. Ett typiskt produktkort (bild, namn, pris, knapp, wrapper) skapar ca 9 DOM-noder.

| Antal kort | DOM-noder | Bedomning |
|-----------:|----------:|-----------|
| 100 | ~900 | Inga problem. Under Lighthouse-grans. |
| 200 | ~1800 | Marginal. Fungerar bra pa desktop, nagon langsamhet pa budget-telefoner. |
| 300 | ~2700 | Borjar marka pa aldre iPhones. |
| 500 | ~4500 | Tydlig pafrestning pa mobil Safari. Scroll-jank mojligt. |
| 1000 | ~9000 | Problematiskt pa mobil. Kraver virtualisering/lazy loading. |

### Mobile Safari (iPhone) specifikt

- Har bara ~25% av desktop-prestanda for DOM-operationer.
- Stora vyer kan fa Safari att spranga GPU-minnesbudgeten och krascha.
- Normal scroll ar hardvaruaccelererad, scroll-events triggas forst i slutet av en scroll-gest (inte under), sa JavaScript-baserad lazy loading ar svart.
- **IntersectionObserver fungerar** och ar ratt satt att lazy-loada bilder.

### Rekommendation

**100-200 kort: inga problem alls.** Det ar den realistiska skalan for detta projekt (nuvarande sida har 68 kort). Vid 300+ kort, lagg till `loading="lazy"` pa bilder (redan gjort) och overväg paginering eller "Load more"-knapp.

Kallor: [web.dev DOM size and interactivity](https://web.dev/articles/dom-size-and-interactivity), [Chrome Lighthouse DOM size](https://developer.chrome.com/docs/lighthouse/performance/dom-size), [DebugBear DOM optimization](https://www.debugbear.com/blog/excessive-dom-size)

---

## 2. Bash-manipulation av JSON inuti HTML

### Arkitekturval: Python, inte sed+jq

**sed+jq fungerar for extrahering** men har tva kritiska problem:
1. Multiline-replacement i sed ar fragilt (breakar pa specialtecken i JSON)
2. Shell-variabel-interpolering forlorar backslash-escapes i JSON-strangar (`\"` blir `"`)

**Python ar det robusta valet.** Det ar redan tillgangligt, hanterar unicode/escaping korrekt, och kan gora atomic writes.

### Kritiskt: Anvand `json.JSONDecoder.raw_decode()`, INTE regex

Naiv regex `const PRODUCTS = (\[.*?\]);` med `re.DOTALL` **BREAKAR** om nagot produktnamn innehaller `];`. Testat och verifierat:

```python
# FEL - breakar pa ]; i strangar
match = re.search(r'const PRODUCTS = (\[.*?\]);', html, re.DOTALL)

# RATT - hanterar ALLA edge cases
import re, json

def extract_products(html):
    start_match = re.search(r'const PRODUCTS\s*=\s*', html)
    if not start_match:
        raise ValueError("Could not find 'const PRODUCTS =' in HTML")
    json_start = start_match.end()
    decoder = json.JSONDecoder()
    products, json_end = decoder.raw_decode(html, json_start)
    # raw_decode returnerar (result, end_index_in_string) - INTE langd!
    return products, json_start, json_end
```

`raw_decode()` anvander JSON-parsern sjalv for att hitta exakt var arrayen slutar. Hanterar nästade brackets, escaped quotes, unicode, och `];` inuti strangar korrekt.

### Komplett extract + inject (verifierad)

```python
import re, json, os

def extract_products(html):
    start_match = re.search(r'const PRODUCTS\s*=\s*', html)
    if not start_match:
        raise ValueError("Could not find 'const PRODUCTS =' in HTML")
    json_start = start_match.end()
    decoder = json.JSONDecoder()
    products, json_end = decoder.raw_decode(html, json_start)
    if not isinstance(products, list):
        raise ValueError(f"PRODUCTS is not an array, got {type(products).__name__}")
    return products, json_start, json_end

def inject_products(html, products, json_start, json_end):
    json_str = json.dumps(products, indent=2, ensure_ascii=False)
    return html[:json_start] + json_str + html[json_end:]

def write_html_atomic(path, content):
    """Atomic write: skriv till temp-fil, sen rename."""
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(content)
    os.replace(tmp, path)  # atomic pa POSIX
```

### Specialtecken

`json.dumps(ensure_ascii=False)` hanterar allt korrekt:
- Svenska tecken (aao) bevaras som UTF-8
- Citattecken escapas automatiskt (`\"`)
- Ampersand (`&`) ar ofarligt i JSON (bara i HTML-attribut)
- Emojis och unicode fungerar

---

## 3. Bildnedladdning i bash

### Download + verifiering

```bash
download_image() {
    local url="$1"
    local output="$2"

    # Ladda ner, folj redirects, fanga HTTP-status
    local http_code
    http_code=$(curl -sL -o "$output" -w '%{http_code}' \
        --connect-timeout 10 --max-time 30 "$url")

    if [ "$http_code" != "200" ]; then
        echo "ERROR: HTTP $http_code" >&2
        rm -f "$output"
        return 1
    fi

    # Verifiera MIME-typ via filens magic bytes (inte extension)
    local mime
    mime=$(file --mime-type -b "$output")

    case "$mime" in
        image/jpeg|image/png|image/webp|image/gif)
            return 0 ;;
        *)
            echo "ERROR: Not an image ($mime)" >&2
            rm -f "$output"
            return 1 ;;
    esac
}
```

`file --mime-type -b` kollar magic bytes (t.ex. JPEG: `FF D8 FF`), inte filandelse. Fangar HTML-felsidor som 403/404-svar som returnerar HTML trots 200-status.

### Saker filnamnsgenering

```bash
safe_filename() {
    local name="$1"
    local ext="${2:-.webp}"
    local slug
    slug=$(echo "$name" | \
        tr '[:upper:]' '[:lower:]' | \
        sed 's/å/a/g; s/ä/a/g; s/ö/o/g; s/é/e/g; s/ü/u/g' | \
        sed 's/[^a-z0-9]/-/g' | \
        sed 's/--*/-/g; s/^-//; s/-$//' | \
        head -c 60 | sed 's/-$//')
    echo "${slug}${ext}"
}

# Resultat (verifierat):
# "Bla mossa med brodyr"  -> bla-mossa-med-brodyr.webp
# "Randig body \"Sailor\"" -> randig-body-sailor.jpg
# "VELOUR overall 0-3man" -> velour-overall-0-3man.webp
```

### WebP vs JPEG

- Behall det format kallsidan levererar. Konvertering ar onodigt overhead.
- `file --mime-type` identifierar formatet korrekt oavsett filandelse.
- For `img`-taggar i HTML spelar det ingen roll: alla moderna browsers stodjer webp.

---

## 4. Deduplicering

Tre falt att kontrollera, i prioritetsordning:

```python
def check_duplicate(products, new_item):
    for p in products:
        if p.get('source_url') and p['source_url'] == new_item.get('source_url'):
            return f"DUPLICATE: source_url matches '{p['name']}'"
        if p.get('id') == new_item.get('id'):
            return f"DUPLICATE: id '{p['id']}' already exists"
        if p.get('name') == new_item.get('name'):
            return f"DUPLICATE: name '{p['name']}' already exists"
    return None  # No duplicate
```

- **source_url** ar mest palitligt (unik per produkt fran kallan)
- **id** ar bra om vi sjalva genererar det (t.ex. `slug-av-namn`)
- **name** ar fallback men kan ge false positives vid namnvariationer

Skriptet ska returnera exit code 1 vid duplikat sa att anroparen vet.

---

## 5. Lista produkter

```bash
# Fran bash - delegera till Python-hjalparen
python3 json-helper.py list index.html

# Formaterad tabell:
python3 -c "
import re, json, sys
with open('index.html') as f: html = f.read()
m = re.search(r'const PRODUCTS\s*=\s*', html)
d = json.JSONDecoder()
products, _ = d.raw_decode(html, m.end())
print(f'Totalt: {len(products)} produkter\n')
for i, p in enumerate(products, 1):
    print(f'{i:3d}. {p[\"name\"]:40s} {p.get(\"price\",\"?\"):>6} kr  {p.get(\"brand\",\"\")}')
"
```

---

## 6. Skriptinterface for agent

### Minimal CLI

```
add-item.sh --name "Produktnamn" --price 299 --url "https://..." --image-url "https://..." [--brand "Brand"] [--size "62/68"] [--category "suits"]
```

### Alla flaggor

| Flagga | Kravs | Beskrivning |
|--------|-------|-------------|
| `--name` | Ja | Produktnamn |
| `--price` | Ja | Pris i SEK (heltal) |
| `--url` | Ja | Lank till produktsidan |
| `--image-url` | Ja | URL till produktbild (laddas ner) |
| `--brand` | Nej | Varumarke |
| `--size` | Nej | Storlekar (t.ex. "56-86") |
| `--category` | Nej | Kategori for sektionsgruppering |
| `--description` | Nej | Kort beskrivning |
| `--extra-images` | Nej | Komma-separerade URLs for ytterligare bilder |
| `--dry-run` | Nej | Visa vad som skulle handa utan att andra |
| `--json` | Nej | Output i JSON (for maskin-parsning) |

### Kommandon

```bash
add-item.sh add --name "..." --price 299 ...   # Lagg till produkt
add-item.sh list                                 # Lista alla produkter
add-item.sh exists --url "https://..."          # Kolla om produkt finns
add-item.sh remove --id "item-042"              # Ta bort produkt
add-item.sh count                                # Antal produkter
```

### Vad en agent behover

Agenten behover bara kunna anropa `add-item.sh add` med produktdata. Skriptet hanterar:
1. Ladda ner bild till `img/`
2. Generera safe filnamn
3. Verifiera att bilden ar giltig
4. Kolla duplikat
5. Lagga till i JSON-arrayen
6. Returnera status (JSON pa stdout, errors pa stderr)

Agenten behover INTE:
- Veta HTML-strukturen
- Hantera JSON-manipulation
- Kanna till filnamnskonventioner

---

## 7. Git push

### Rekommendation: Skriptet committar, agenten pushar

```bash
# add-item.sh gor detta automatiskt:
git add img/ny-bild.webp index.html
git commit -m "add: Produktnamn (Brand)"

# Agenten kan sedan pusha nar den ar klar med alla tillagg:
git push origin main
```

**Varfor separera push:**
- Agenten kan lagga till 5 produkter i rad, sedan pusha en gang
- En push per produkt ar onodig overhead (GitHub Pages bygger om vid varje push)
- Om nagot gar fel kan agenten resa tillbaka hela batchen

**Varfor skriptet ska committa:**
- Varje produkt-tillagg ar en atomic enhet (bild + JSON-andring)
- Om nasta tillagg failar har man inte forlorat det forega
- Git-historiken blir tydlig: en commit per produkt

### Bildstorlekar och git

60 bilder i nuvarande `img/` ar rimligt. GitHub varnar vid filer over 50 MB (och nekar over 100 MB). Produktbilder ar typiskt 50-500 KB, sa inga problem.

---

## 8. Edge cases

### Tva agenter samtidigt

**Problem:** Om tva instanser av `add-item.sh` kor samtidigt kan de lasa samma HTML, lagga till var sin produkt, och den sista att skriva overskriver den forstas andring.

**Losning: `flock`** (testat och verifierat)

```bash
LOCKFILE="${SITE_DIR}/.add-item.lock"
exec 200>"$LOCKFILE"
if ! flock -n 200; then
    echo "ERROR: Another add-item.sh is running. Try again." >&2
    exit 1
fi
# Lock friggs automatiskt nar skriptet avslutas
```

`flock -n` ar non-blocking: returnerar direkt med felkod om laset redan halls. Laset frigors automatiskt vid exit (oavsett hur skriptet avslutas).

### Nedladdning misslyckas mitt i

**Losning:** Ladda ner bilden forst, verifiera, och modifiera HTML sist.

```
1. Ladda ner bild till tempfil
2. Verifiera MIME-typ
3. Flytta till img/ (atomic rename)
4. Gor JSON-andring
5. Atomic write av HTML
```

Om steg 1-2 failar har ingen andring gjorts. Om steg 4-5 failar finns bilden i `img/` men HTML ar oandrad (oproblematiskt, bilden ar bara en extra fil).

### HTML-fil korrupterad

**Forsvarslinjer:**
1. `extract_products()` kastar ValueError om JSON inte kan parsas -> skriptet avbryter
2. Atomic write (`os.replace`) garanterar att filen antingen ar helt ny eller helt gammal, aldrig halvskriven
3. Backup fore andring:

```bash
cp index.html "index.html.bak.$(date +%s)"
```

4. Git ar yttersta sakerhetsnat: `git checkout index.html` aterstaller senaste committade version.

### Max filstorlek for index.html pa GitHub Pages

- **GitHub Pages-grans:** Publicerade sajter max 1 GB totalt. Enskilda filer max 100 MB (varning vid 50 MB).
- **Praktisk grans for index.html:** Med 200 produkter (9 falt vardera, pretty-printed JSON) ar filen ca 100-150 KB. Med 1000 produkter ca 500 KB. Nuvarande fil ar 100 KB med 68 hardkodade kort.
- **Ingen risk:** Aven med 2000 produkter och all CSS/JS i samma fil landar man under 2 MB. GitHub Pages-gransen ar irrelevant for detta projekt.

| Repo-grans | Grans |
|------------|-------|
| Publicerad sajt | 1 GB |
| Enskild fil (varning) | 50 MB |
| Enskild fil (hard limit) | 100 MB |
| Bandwidth | 100 GB/manad (soft) |
| Deploys | 10/timme (soft) |

Kalla: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

---

## Sammanfattning: Rekommenderad arkitektur

1. **JSON-i-HTML fungerar bra** for upp till 200+ produkter. Ingen prestanda-risk.
2. **Python for JSON-manipulation** (inte sed/jq). `raw_decode()` ar den enda robusta metoden.
3. **`add-item.sh`** som wrapper runt en Python-hjalpare. Bash for bildnedladdning och git, Python for JSON.
4. **flock** for att forhindra race conditions.
5. **Atomic writes** (`os.replace`) for att forhindra korruption.
6. **En commit per produkt, en push per batch.**
7. **`--dry-run`** for att agenten kan forhandsgranska.
