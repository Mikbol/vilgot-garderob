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

Vänta på Pages build, sedan:

**7a. curl alla ändrade URL:er:**
```bash
# Tiny Universe (7 st)
for url in \
  "https://thetinyuniverse.com/products/the-tiny-tuxedo-classic-style" \
  "https://thetinyuniverse.com/products/the-tiny-tuxedo" \
  "https://thetinyuniverse.com/products/the-tiny-tuxedo-red-bow-tie" \
  "https://thetinyuniverse.com/products/the-tiny-body-tuxedo"; do
  curl -sL -o /dev/null -w "HTTP %{http_code}: $url\n" "$url"
done

# Jacadi (3 st)
for url in \
  "https://www.jacadi.ie/products/baby-boy-linen-set-2045169-j0971" \
  "https://www.jacadi.ie/products/baby-boy-set-in-garter-stitch-2044438-j0152" \
  "https://www.jacadi.ie/products/baby-boy-trousers-set-2019508-j0198"; do
  curl -sL -o /dev/null -w "HTTP %{http_code}: $url\n" "$url"
done
```
Pass: alla HTTP 200 eller 301.

**7b. Bildverifiering:**
```bash
curl -sL -o /dev/null -w "HTTP %{http_code}\n" "https://mikbol.github.io/vilgot-garderob/img/lilax-tux-grey.jpg"
```
Pass: HTTP 200.

**7c. WebFetch:** Kontrollera att antal produkter matchar `./add-item.sh count` och att inga samlingslänkar finns bland de ändrade produkterna.

**7d. Chrome (om anslutet):** JavaScript: scrolla sidan, kolla `img.complete && img.naturalWidth > 0` för lilax-tux-grey.jpg. Screenshot av produktkortet.

**Tid:** 3 min.

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
