# Plan: Fixa alla produkter utan bilder

Skapad: 2026-03-18
Research: `research-site-redesign.md`

## Mål

Alla 75 produkter ska ha riktiga produktbilder. 11 saknar bilder idag. 5 av dessa är utgångna H&M-produkter som ersätts med aktuella.

## Steg 1: Ladda ned alla 11 bilder

Ladda ned via curl till `img/`. Verifiera varje bild med `file` (ska vara image/jpeg eller image/png).

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site

# Amazon (4 st)
curl -sL -o img/flat-scally-cap-tweed.jpg "https://m.media-amazon.com/images/I/8138TZ2CLML._AC_SL1500_.jpg"
curl -sL -o img/tweed-driver-cap-beige.jpg "https://m.media-amazon.com/images/I/71W1rLSe-zL._AC_SL1024_.jpg"
curl -sL -o img/herringbone-newsboy-cap.jpg "https://m.media-amazon.com/images/I/71No8XE3aUL._AC_SL1024_.jpg"
curl -sL -o img/gentleman-waistcoat-tuxedo-onesie.jpg "https://m.media-amazon.com/images/I/51PNtn+wNXL._AC_SL1001_.jpg"

# Etsy representativ bild (1 st, hämta i högre upplösning)
curl -sL -o img/newsboy-hat-suspenders-set.jpg "https://i.etsystatic.com/14197990/r/il/5225f1/5557410037/il_794xN.5557410037_4ibn.jpg"

# H&M befintlig produkt (1 st)
curl -sL -o img/hm-3-delat-dressat-marinbla.jpg "https://image.hm.com/assets/hm/4b/b5/4bb58422b9b7bee3f8b01564424615272d4adfd7.jpg?imwidth=800"

# H&M nya ersättningsprodukter (4 st)
curl -sL -o img/hm-4-delat-dressat-ljusbeige.jpg "https://image.hm.com/assets/hm/9c/d7/9cd7a0e47a66e1e6111f21318d020544ae960dd4.jpg?imwidth=800"
curl -sL -o img/hm-4-delat-dressat-khakigron.jpg "https://image.hm.com/assets/hm/47/98/4798344ad98b2bf257c972d957d887497ef98ac3.jpg?imwidth=800"
curl -sL -o img/hm-4-delat-kostymset-ljusbeige.jpg "https://image.hm.com/assets/hm/33/f4/33f4df27d4270ef207473f820f76a2752e776be3.jpg?imwidth=800"
curl -sL -o img/hm-4-delat-dressat-vit-bla.jpg "https://image.hm.com/assets/hm/a8/21/a821aff8ad03c7d3939b690f9d8202381a67a819.jpg?imwidth=800"
```

**Verifiering:**
```bash
for f in img/flat-scally-cap-tweed.jpg img/tweed-driver-cap-beige.jpg img/herringbone-newsboy-cap.jpg img/gentleman-waistcoat-tuxedo-onesie.jpg img/newsboy-hat-suspenders-set.jpg img/hm-3-delat-dressat-marinbla.jpg img/hm-4-delat-dressat-ljusbeige.jpg img/hm-4-delat-dressat-khakigron.jpg img/hm-4-delat-kostymset-ljusbeige.jpg img/hm-4-delat-dressat-vit-bla.jpg; do
  SIZE=$(wc -c < "$f" | tr -d ' ')
  TYPE=$(file --mime-type -b "$f")
  echo "$TYPE ${SIZE}B: $f"
done
```
Pass: alla ska vara `image/jpeg` eller `image/png` och > 10000 bytes.
Fail: annan MIME-typ eller < 10000 bytes (troligen felmeddelande, inte bild).

**Tid:** 2 min.

## Steg 2: Uppdatera PRODUCTS i index.html

Gör följande ändringar i PRODUCTS-arrayen med Python:

### 2a. Uppdatera 5 befintliga produkter med bilder (ID 20, 30, 31, 32, 34, 43)

| ID | Produkt | Lägg till `images` |
|---|---|---|
| 20 | 3-delat dressat set med fluga (Marinblå) | `["img/hm-3-delat-dressat-marinbla.jpg"]` |
| 30 | Flat Scally Cap (Tweed, Svart) | `["img/flat-scally-cap-tweed.jpg"]` |
| 31 | Tweed Page Driver Cap (Beige) | `["img/tweed-driver-cap-beige.jpg"]` |
| 32 | Herringbone Newsboy Cap | `["img/herringbone-newsboy-cap.jpg"]` |
| 34 | Newsboy Hat + Suspenders Sets | `["img/newsboy-hat-suspenders-set.jpg"]` |
| 43 | Gentleman Waistcoat Tuxedo Onesie | `["img/gentleman-waistcoat-tuxedo-onesie.jpg"]` |

Ta bort `placeholder_text` och `placeholder_style` från dessa produkter.

### 2b. Ersätt 5 utgångna H&M-produkter (ID 19, 21, 22, 23, 24)

Ta bort de 5 utgångna produkterna (URL:er som redirectar till startsidan) och lägg till 4 nya:

| Ny produkt | Pris | URL | Bild |
|---|---|---|---|
| 4-delat dressat set i linmix (Ljusbeige) | 349 kr | `.../1292410004.html` | `img/hm-4-delat-dressat-ljusbeige.jpg` |
| 4-delat dressat set i linmix (Khakigrön) | 349 kr | `.../1292410005.html` | `img/hm-4-delat-dressat-khakigron.jpg` |
| 4-delat kostymset (Ljusbeige) | 499 kr | `.../1242064002.html` | `img/hm-4-delat-kostymset-ljusbeige.jpg` |
| 4-delat dressat set i linmix (Vit/Blå) | 349 kr | `.../1292410001.html` | `img/hm-4-delat-dressat-vit-bla.jpg` |

Brand: H&M. Section: H&M. Size: Från 56.

**Netto:** -5 utgångna + 4 nya = -1. Totalt 74 produkter.

**Verifiering:**
```bash
./add-item.sh count
# Förväntat: 74
python3 -c "
import json, re
with open('index.html') as f: content = f.read()
match = re.search(r'const PRODUCTS = (\[.*?\]);', content, re.DOTALL)
products = json.loads(match.group(1))
no_img = [p['name'] for p in products if not p.get('images') or len(p['images']) == 0]
print(f'Produkter utan bild: {len(no_img)}')
for n in no_img: print(f'  {n}')
"
# Förväntat: 0 produkter utan bild
```

**Tid:** 10 min.

## Steg 3: Commit och push

```bash
git add index.html img/
git commit -m "fix: riktiga bilder för alla produkter, ersätt 5 utgångna H&M med aktuella

- 6 befintliga produkter: bilder nedladdade (Amazon, Etsy, H&M)
- 5 utgångna H&M: borttagna (produktsidor existerar inte)
- 4 nya H&M: aktuella dressat-set med bilder och fungerande produktlänkar
- 0 produkter utan bild"
git push origin main
```

**Tid:** 1 min.

## Steg 4: Vänta på Pages build

```bash
for i in 1 2 3 4 5; do
  STATUS=$(gh api repos/Mikbol/vilgot-garderob/pages --jq '.status')
  echo "Försök $i: $STATUS"
  [ "$STATUS" = "built" ] && break
  sleep 30
done
```

**Tid:** 1-3 min.

## Steg 5: Verifiera live-sajt (OBLIGATORISKT, alla delar)

### 5a. Nya bilder serveras (curl)

```bash
for f in flat-scally-cap-tweed.jpg tweed-driver-cap-beige.jpg herringbone-newsboy-cap.jpg gentleman-waistcoat-tuxedo-onesie.jpg newsboy-hat-suspenders-set.jpg hm-3-delat-dressat-marinbla.jpg hm-4-delat-dressat-ljusbeige.jpg hm-4-delat-dressat-khakigron.jpg hm-4-delat-kostymset-ljusbeige.jpg hm-4-delat-dressat-vit-bla.jpg; do
  curl -sL -o /dev/null -w "HTTP %{http_code}: $f\n" "https://mikbol.github.io/vilgot-garderob/img/$f"
done
```
Pass: alla HTTP 200.

### 5b. Nya H&M-produktlänkar fungerar (curl)

```bash
for url in \
  "https://www2.hm.com/sv_se/productpage.1292410004.html" \
  "https://www2.hm.com/sv_se/productpage.1292410005.html" \
  "https://www2.hm.com/sv_se/productpage.1242064002.html" \
  "https://www2.hm.com/sv_se/productpage.1292410001.html"; do
  curl -sL -o /dev/null -w "HTTP %{http_code}: $url\n" "$url"
done
```
Pass: alla HTTP 200.

### 5c. Antal produkter (WebFetch)

WebFetch mot live-sajten: kontrollera att antal = `./add-item.sh count` = 74.

### 5d. Fullständig sajt-verifiering (Chrome, OBLIGATORISK)

Navigera till live-sajten. Scrolla hela sidan (dubbelt, upp+ned) för lazy load. Kör fullVerify():

```javascript
async function fullVerify() {
  for (let y = 0; y < document.body.scrollHeight; y += 300) {
    window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80));
  }
  await new Promise(r => setTimeout(r, 2000));
  for (let y = document.body.scrollHeight; y >= 0; y -= 300) {
    window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80));
  }
  await new Promise(r => setTimeout(r, 1000));

  const imgs = document.querySelectorAll('img');
  const broken = [];
  imgs.forEach(img => {
    if (!(img.complete && img.naturalWidth > 0)) {
      let name = '';
      for (let el = img; el; el = el.parentElement) {
        const h3 = el.querySelector('h3');
        if (h3) { name = h3.textContent; break; }
      }
      broken.push({ name: name || img.alt, src: img.src });
    }
  });

  const buyLinks = Array.from(document.querySelectorAll('a')).filter(a => a.textContent.includes('Köp'));
  const badLinks = buyLinks.map(a => {
    let el = a, name = '';
    for (let i = 0; i < 5; i++) { el = el.parentElement; if (!el) break; const h3 = el.querySelector('h3'); if (h3) { name = h3.textContent; break; } }
    const url = a.href;
    const bad = (url.includes('/collections') && !url.includes('/products/')) || (url.includes('/market/') && !url.includes('etsy.com/market/'));
    return bad ? { name, url } : null;
  }).filter(Boolean);

  const sections = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()).filter(t => t.length > 0);

  return JSON.stringify({
    images: { total: imgs.length, loaded: imgs.length - broken.length, broken: broken.length, brokenList: broken },
    links: { total: buyLinks.length, bad: badLinks.length, badList: badLinks },
    sections: sections.length
  });
}
fullVerify();
```

Pass: 0 trasiga bilder, 0 felaktiga köp-länkar, sektioner = 15, köp-länkar = 74.

### 5e. Visuell verifiering av nya bilder (Chrome screenshots, OBLIGATORISK)

Scrolla till varje ny/ändrad produkt. Ta screenshot. Bekräfta visuellt att bilden visar rätt plagg:

- H&M-produkter: dressat set med väst, skjorta, byxor, fluga
- Flat Scally Cap: baby med tweed-keps
- Tweed Driver Cap: baby med beige keps
- Herringbone Newsboy: baby med newsboy cap
- Newsboy + Suspenders: set med keps + hängslen
- Gentleman Waistcoat Onesie: romper med väst-tryck och fluga

Om en bild visar fel plagg eller är trasig: felsök, fixa, push, verifiera igen.

**Om Chrome inte är anslutet:** Vänta. Denna verifiering kan INTE hoppas över.

**Tid:** 10 min.

## Steg 6: Uppdatera dokument

- `research-site-redesign.md`: uppdatera med H&M-ersättningsdata
- `beslut-site-redesign.md`: uppdatera beslut 1 (ersätt istället för ta bort)
- `STATUS.md`: uppdatera antal produkter, bildstatus
- `PLAN-fix-missing-images.md`: markera alla steg som ✅ med resultat

**Tid:** 3 min.

## Rollback

```bash
git revert HEAD
git push origin main
```

## Total tid

| Steg | Tid |
|------|-----|
| 1. Ladda ned bilder | 2 min |
| 2. Uppdatera index.html | 10 min |
| 3. Commit + push | 1 min |
| 4. Pages build | 1-3 min |
| 5. Verifiera live (curl + WebFetch + Chrome fullVerify + screenshots) | 10 min |
| 6. Dokument | 3 min |
| **Total** | **27-29 min** |
