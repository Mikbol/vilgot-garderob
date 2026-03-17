# Plan: Fixa pre-existing sajt-problem

Skapad: 2026-03-17
Research: `research-site-issues.md`

## Mål

Fixa 1 trasig bild och 10 samlingslänkar (av 13 identifierade, 2 Etsy behålls, 1 Jacadi kräver beslut). Alla steg körs autonomt av Claude.

## Steg 1: Fixa trasig bild

**Vad:** `img/lilax-tux-grey.webp` är en JPEG med fel filändelse.

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site
mv img/lilax-tux-grey.webp img/lilax-tux-grey.jpg
```

Uppdatera referensen i index.html (PRODUCTS-arrayen, ID 64): `"img/lilax-tux-grey.webp"` → `"img/lilax-tux-grey.jpg"`.

**Verifiering:**
```bash
file img/lilax-tux-grey.jpg
# Förväntat: JPEG image data
```

**Tid:** 1 min.

## Steg 2: Uppdatera 7 Tiny Universe-länkar

Byt URL i index.html PRODUCTS-arrayen för varje produkt:

| ID | Från | Till |
|---|---|---|
| 1 | `thetinyuniverse.com/collections/suits-tuxedos` | `thetinyuniverse.com/products/the-tiny-tuxedo-classic-style` |
| 2 | `thetinyuniverse.com/collections/suits-tuxedos` | `thetinyuniverse.com/products/the-tiny-tuxedo` |
| 3 | `thetinyuniverse.com/collections/suits-tuxedos` | `thetinyuniverse.com/products/the-tiny-tuxedo` |
| 5 | `thetinyuniverse.com/collections/suits-tuxedos` | `thetinyuniverse.com/products/the-tiny-tuxedo-red-bow-tie` |
| 6 | `thetinyuniverse.com/collections/suits-tuxedos` | `thetinyuniverse.com/products/the-tiny-body-tuxedo` |
| 7 | `thetinyuniverse.com/collections/suits-tuxedos` | `thetinyuniverse.com/products/the-tiny-body-tuxedo` |
| 8 | `thetinyuniverse.com/collections/suits-tuxedos` | `thetinyuniverse.com/products/the-tiny-body-tuxedo` |

ID 2+3 delar URL (White/Black är varianter). Samma för 6+7+8. Korrekt beteende: användaren landar på produkten och väljer variant själv.

**Verifiering:** curl varje ny URL, förvänta HTTP 200 eller 301 (redirect till kanonisk URL).

**Tid:** 5 min.

## Steg 3: Uppdatera 3 Jacadi-länkar

| ID | Från | Till |
|---|---|---|
| 27 | `jacadi.ie/collections/newborn-boy` | `jacadi.ie/products/baby-boy-linen-set-2045169-j0971` |
| 28 | `jacadi.ie/collections/newborn-boy` | `jacadi.ie/products/baby-boy-set-in-garter-stitch-2044438-j0152` |
| 29 | `jacadi.ie/collections/newborn-boy` | `jacadi.ie/products/baby-boy-trousers-set-2019508-j0198` |

**Verifiering:** curl varje ny URL, förvänta HTTP 200.

**Tid:** 2 min.

## Steg 4: Hantera Jacadi jumpsuit (ID 30)

Produkten "Baby Boy Jumpsuit in Jersey" hittades inte på Jacadi-sajten. Två alternativ:

**A.** Ta bort produkten (`./add-item.sh remove --id 30`)
**B.** Behåll men lägg till tag "Utgången?" och behåll samlingslänken

Väljer **A** (ta bort). Produkten har ingen riktig URL och kan inte verifieras.

**Verifiering:** `./add-item.sh count` ska vara ett mindre.

**Tid:** 1 min.

## Steg 5: Etsy-länkarna (ID 15, 35)

Behålls som de är. De är Etsy-sökkategorier, inte specifika produkter. Dokumenterat i research.

Ingen åtgärd.

## Steg 6: Commit och push

```bash
git add index.html img/lilax-tux-grey.jpg
git rm img/lilax-tux-grey.webp
git commit -m "fix: 10 samlingslänkar → produktsidor, trasig bild .webp → .jpg, ta bort utgången Jacadi"
git push origin main
```

**Tid:** 1 min.

## Steg 7: Verifiera live-sajt

Vänta på Pages build, sedan köra ALLA verifieringar. Ingen är valfri.

**7a. Mål-URL:er finns (curl):**
```bash
for url in \
  "https://thetinyuniverse.com/products/the-tiny-tuxedo-classic-style" \
  "https://thetinyuniverse.com/products/the-tiny-tuxedo" \
  "https://thetinyuniverse.com/products/the-tiny-tuxedo-red-bow-tie" \
  "https://thetinyuniverse.com/products/the-tiny-body-tuxedo" \
  "https://www.jacadi.ie/products/baby-boy-linen-set-2045169-j0971" \
  "https://www.jacadi.ie/products/baby-boy-set-in-garter-stitch-2044438-j0152" \
  "https://www.jacadi.ie/products/baby-boy-trousers-set-2019508-j0198"; do
  curl -sL -o /dev/null -w "HTTP %{http_code}: $url\n" "$url"
done
```
Pass: alla HTTP 200 eller 301.

**7b. Fixad bild laddas som pixel (Chrome JavaScript, OBLIGATORISKT):**

Navigera till live-sajten. Scrolla hela sidan för lazy load. Kör:
```javascript
const img = document.querySelector('img[src*="lilax-tux-grey"]');
if (!img) { 'FAIL: bild inte i DOM' }
else if (img.complete && img.naturalWidth > 0) {
  `PASS: ${img.naturalWidth}x${img.naturalHeight}`
} else { 'FAIL: bild finns i DOM men renderar inte' }
```
Pass: PASS med dimensioner > 0. Fail: allt annat.

**Ta screenshot** av produktkortet "Gentleman Tuxedo Footie" och bekräfta visuellt att bilden visar ett babyklädesplagg (inte trasig ikon, inte tom ruta).

**7c. Köp-länkar på sajten pekar rätt (Chrome JavaScript, OBLIGATORISKT):**

HTTP 200 bevisar att mål-URL:en finns, men inte att köp-knappen på sajten pekar dit. Verifiera att de faktiska href-attributen i DOM matchar de nya URL:erna:

```javascript
const links = Array.from(document.querySelectorAll('a'));
const buyLinks = links.filter(a => a.textContent.includes('Köp'));
const stillBad = buyLinks.map(a => {
  let el = a;
  let name = '';
  for (let i = 0; i < 5; i++) { el = el.parentElement; if (!el) break; const h3 = el.querySelector('h3'); if (h3) { name = h3.textContent; break; } }
  const url = a.href;
  const isCollection = (url.includes('/collections') && !url.includes('/products/')) || url.includes('/market/');
  // Etsy-sök är OK (medvetet behållna)
  const isEtsy = url.includes('etsy.com/market/');
  return (isCollection && !isEtsy) ? { name, url } : null;
}).filter(Boolean);
stillBad.length === 0 ? 'PASS: 0 samlingslänkar (exkl. Etsy)' : JSON.stringify(stillBad);
```
Pass: `PASS: 0 samlingslänkar`. Fail: lista med kvarvarande samlingslänkar.

**7d. Antal produkter (WebFetch):**

WebFetch mot live-sajten: kontrollera att antal matchar `./add-item.sh count` och att "Baby Boy Jumpsuit in Jersey" inte finns.

**Om Chrome inte är anslutet:** Steg 7b och 7c kan INTE hoppas över. De verifierar att ändringarna faktiskt syns för användaren. Vänta tills Chrome är anslutet, eller be Mikael ansluta det. Markera verifieringen som INTE GENOMFÖRD tills dess.

**Tid:** 5 min.

## Steg 8: Uppdatera dokument

- STATUS.md: ta bort "pre-existing problem" eller markera som fixade
- PLAN-auto-discovery.md: uppdatera "Kända pre-existing problem" sektionen

**Tid:** 1 min.

## Rollback

```bash
git revert HEAD
git push origin main
```

## Total tid

| Steg | Tid |
|------|-----|
| 1. Trasig bild | 1 min |
| 2. Tiny Universe (7 st) | 5 min |
| 3. Jacadi (3 st) | 2 min |
| 4. Ta bort Jacadi jumpsuit | 1 min |
| 5. Etsy (ingen åtgärd) | 0 min |
| 6. Commit + push | 1 min |
| 7. Verifiera live | 3 min |
| 8. Dokument | 1 min |
| **Total** | **14 min** |

## Resultat (2026-03-17)

Alla steg genomförda och verifierade.

| Verifiering | Resultat |
|---|---|
| 7a. curl mål-URL:er | PASS: alla 7 HTTP 200 |
| 7b. Chrome pixelcheck lilax-tux-grey.jpg | PASS: complete=true, 2000x3000, screenshot visar grå tuxedo footie |
| 7c. Chrome DOM href samlingslänkar | PASS: 0 samlingslänkar (exkl. 2 Etsy, medvetet behållna) |
| 7d. WebFetch antal produkter | PASS: 75 produkter, jumpsuit borta |
