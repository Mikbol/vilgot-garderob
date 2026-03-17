# Research: Pre-existing sajt-problem

Datum: 2026-03-17

## Problem 1: Trasig bild (lilax-tux-grey.webp)

**Produkt:** Gentleman Tuxedo Footie (ID 64, sektion Lilax: Tuxedo Footies)

**Orsak:** Filen `img/lilax-tux-grey.webp` är en JPEG-fil (2000x3000, 121 KB) med `.webp`-filändelse. Browsern försöker dekoda den som WebP och misslyckas.

**Källa:** `file img/lilax-tux-grey.webp` → `JPEG image data, progressive, precision 8, 2000x3000`

**Fix:** Byt filändelse till `.jpg` och uppdatera referensen i index.html.

## Problem 2: 13 köp-länkar pekar på samlingssidor

### Grupp A: The Tiny Universe (7 st)

Alla 7 pekar på `https://thetinyuniverse.com/collections/suits-tuxedos`. Butiken har individuella produktsidor.

| ID | Produktnamn | Rätt URL (verifierad via WebFetch) |
|---|---|---|
| 1 | The Tiny Tuxedo Classic | https://thetinyuniverse.com/products/the-tiny-tuxedo-classic-style |
| 2 | The Tiny Tuxedo White | https://thetinyuniverse.com/products/the-tiny-tuxedo |
| 3 | The Tiny Tuxedo Black | https://thetinyuniverse.com/products/the-tiny-tuxedo |
| 5 | The Tiny Tuxedo Red Bow-Tie | https://thetinyuniverse.com/products/the-tiny-tuxedo-red-bow-tie |
| 6 | The Tiny Body Tuxedo | https://thetinyuniverse.com/products/the-tiny-body-tuxedo |
| 7 | The Tiny Body Tuxedo White | https://thetinyuniverse.com/products/the-tiny-body-tuxedo |
| 8 | The Tiny Body Tuxedo Black | https://thetinyuniverse.com/products/the-tiny-body-tuxedo |

Notering: ID 2 och 3 delar URL (White/Black är varianter av samma produkt). Samma för ID 6, 7, 8.

### Grupp B: Jacadi Paris (4 st)

Alla 4 pekar på `https://www.jacadi.ie/collections/newborn-boy`. 3 av 4 har individuella produktsidor. 1 hittades inte.

| ID | Produktnamn | Rätt URL | Status |
|---|---|---|---|
| 27 | Baby Boy Linen Set | https://www.jacadi.ie/products/baby-boy-linen-set-2045169-j0971 | Verifierad |
| 28 | Baby Boy Set in Garter Stitch | https://www.jacadi.ie/products/baby-boy-set-in-garter-stitch-2044438-j0152 | Verifierad |
| 29 | Baby Boy Trousers Set | https://www.jacadi.ie/products/baby-boy-trousers-set-2019508-j0198 | Verifierad |
| 30 | Baby Boy Jumpsuit in Jersey | Ej hittad på samlingssidan | Saknas, möjligen utgången |

### Grupp C: Etsy (2 st)

Pekar på Etsy-marknadsplatssökningar, inte specifika produkter. Etsy har inga fasta produktsidor för dessa (det är sökresultat som visar många säljare).

| ID | Produktnamn | Nuvarande URL | Åtgärd |
|---|---|---|---|
| 15 | Preemie Tuxedo Rompers | https://www.etsy.com/market/preemie_tuxedo | Behåll (det är en sök-kategori, inte en specifik produkt) |
| 35 | Newsboy Hat + Suspenders Sets | https://www.etsy.com/market/newsboy_hat_baby_suspenders | Behåll (samma logik) |

## Sammanfattning

| Grupp | Antal | Åtgärd |
|---|---|---|
| Trasig bild | 1 | Byt .webp → .jpg |
| Tiny Universe | 7 | Byt till produktsidor (alla verifierade) |
| Jacadi | 3 | Byt till produktsidor (verifierade) |
| Jacadi (utgången) | 1 | Ta bort produkten eller behåll med samlingslänk + markering |
| Etsy | 2 | Behåll (sök-kategorier, inte specifika produkter) |

Total: 11 URL-byten + 1 bildbyte + 1 beslut (Jacadi jumpsuit).

## Evidensluckor

- Jacadi-produktsidorna kan ändra URL om sortimentet uppdateras. Verifierat 2026-03-17 men kan vara inaktuellt om en månad.
- Tiny Universe produktsidor: White/Black-varianter delar URL. Oklart om browsern landar på rätt variant.
- Etsy-sök-URL:erna visar olika resultat beroende på region och tid. Kan vara tomt ibland.
