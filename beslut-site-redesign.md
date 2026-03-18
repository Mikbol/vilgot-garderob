# Beslut: Sajt-redesign

Datum: 2026-03-18
Uppdaterad: 2026-03-18 (PoC-resultat bekräftar beslut 4-9)
Research: `research/research-site-redesign.md`
PoC: `poc/v1/` (testad, resultat i `poc/v1/RESULTAT.md`)
Task: `task-site-redesign.md`

## 1. H&M-produkter utan bilder

**Beslut: Ersätt 5 utgångna H&M-produkter med 4 aktuella. Behåll 1 befintlig med ny bild.**

5 av 6 H&M-produkter redirectar till startsidan (utgångna). Chrome-automation mot hm.com fungerar (till skillnad från webfetch/curl). Sökning hittade 4 aktuella gentleman-set med väst+fluga+byxor (349-499 kr). Bilder hämtade via Chrome JS.

Netto: -5 +4 = -1 H&M-produkt. Alla med bilder och fungerande produktlänkar.

## 2. Accessoar-placeholders (4 st)

**Beslut: Hämta bilder för alla 4 via Chrome (Amazon CDN + Etsy).**

Alla 4 bilder hämtade. 3 från Amazon CDN (Born to Love caps), 1 representativ bild från Etsy-söksida.

## 3. Romper-placeholder (1 st)

**Beslut: Hämta bild via Chrome (Amazon CDN).**

Bild hämtad.

## 4. Platt lista

**Beslut: Ta bort sektionsrubriker och beskrivningar. Visa alla produkter i en enda ström.**

Behåll `section`-fältet per produkt som metadata (används av filtret). Implementera filtrering i samma steg (platt lista utan filter = oöverskådligt).

Bortvalda: Collapsible sektioner (löser inte att nya produkter hamnar i mitten), tagg-baserad gruppering (identiskt med platt lista + filter).

## 5. Sortering

**Beslut: `[...PRODUCTS].reverse()` vid rendering.**

Inget `added_date`-fält. Index = tillagd ordning, reverse = senast först. Om det behövs i framtiden kan `added_date` läggas till utan att bryta befintlig data.

Bortvalda: Användarval av sortering (pris/namn/brand) kräver valutanormalisering och UI, oproportionerlig komplexitet för sajten. added_date-fält kräver ändring i add-item.sh/json-helper.py utan tydligt värde.

## 6. localStorage

**Beslut: URL-baserat schema.**

Spara sedda produkt-URL:er i `vilgot-seen-urls`. URL:er är unika och stabila även om produkter tas bort. Första besöket: alla visas som "nya" (acceptabelt).

Bortvalda: Index-baserat (havererar vid remove), hash-baserat (kolliderar om namn ändras), URL+timestamp (timestamp tillför inget värde).

## 7. Animationer

**Beslut: GSAP 3.13 via CDN + befintlig canvas-confetti.** (Bekräftat via PoC v1)

GSAP är gratis (Webflow-sponsrat), 70 KB, branschstandard. PoC bekräftade att elastic bounce + stagger + konfetti ger den wow-faktor som eftersöks. CSS-only räcker inte (saknar stagger, elastic easing). anime.js hade fungerat men GSAP var enklare att implementera. Effekter för nya produkter:
- Elastic scale bounce (kort poppar upp)
- Glow pulse (CSS box-shadow)
- Stagger (kort efter kort i kaskad)
- Konfetti per nytt kort (canvas-confetti redan importerad)
- "NY!" badge med shimmer-animation

Animeras bara vid första sidladdningen för produkter som inte finns i localStorage. Markeras som "sedda" efter animering.

Bortvalda: anime.js (17 KB, fungerar men färre easing-funktioner, PoC visade GSAP enklare), CSS-only (saknar stagger+elastic), Motion One (mindre community), inga animationer (Mikael specificerade "extrema animationer").

## 8. Filtrering

**Beslut: Sticky filter-bar med pills.** (Bekräftat via PoC v1)

PoC visade att pills fungerar visuellt. Med 36 brands behövs collapse ("Övriga"). Mobil 375px: filter collapsar till "Filter"-knapp, acceptabelt.

- **Brand:** Topp 9 (3+ produkter) som pills + "Övriga" som expanderbar grupp
- **Storlek:** 7 normaliserade grupper (Prematur, Newborn, 0-3M, 3-6M, 6M+, 56-62, One size)
- **Pris:** 3 predefined ranges i SEK ("Under 300 kr", "300-700 kr", "Över 700 kr"). USD-priser konverteras med statisk kurs 1 USD = 10.5 kr. "Varierar" exkluderas.
- **Bara nya:** Toggle
- Antal matchande visas ("23 av 75")
- Aktiva filter med "X" för att ta bort

## 9. Kodstruktur

**Beslut: Hybrid. PRODUCTS+SECTIONS i index.html, rendering i app.js, CSS i style.css.** (Reviderat 2026-03-18)

Tidigare beslut: allt i index.html. Reviderat baserat på ny research: 2541 rader i en fil gör det svårt att redigera rendering-logiken utan att ladda 1270 rader produktdata i context. add-item.sh/json-helper.py söker efter `const PRODUCTS = ` via regex och behöver inte ändras.

- `index.html`: HTML-struktur + `<script>` med PRODUCTS + SECTIONS data (~1500 rader)
- `app.js`: Rendering, filtrering, animationer, localStorage (~300 rader)
- `style.css`: All CSS (~750 rader)

## Krav (testbara)

### Platt lista
- Inga sektionsrubriker (h2) synliga i rendering
- Alla 80 produkter visas i en enda ström
- Senast tillagda produkter överst

### Filtrering
- Filter för brand, storlek, pris, "bara nya" ska finnas
- Alla filter kombinerbara (brand + storlek + pris samtidigt)
- Filtrering ska vara omedelbar (ingen sidladdning, DOM show/hide)
- Räknare visar "X av Y" produkter
- Mobil (375px): filter collapsar till en knapp

### Animationer
- Nya produkter (inte i localStorage) animeras vid sidladdning
- Elastic bounce + glow + konfetti per nytt kort
- Animationer körs en gång, sedan markeras produkten som sedd
- Om 0 nya produkter: ingen animation
- Animationer blockar inte interaktion (användaren kan scrolla under animation)

### localStorage
- Sedda produkter sparas som URL:er
- Rensa localStorage → alla produkter visas som "nya" igen
- Funkar utan localStorage (graceful degradation: alla visas utan "ny"-markering)

### Kodstruktur
- PRODUCTS och SECTIONS kvar i index.html (add-item.sh fungerar utan ändring)
- `./add-item.sh count` returnerar korrekt antal efter redesign
- app.js och style.css laddas korrekt från GitHub Pages

### Verifiering
- Chrome fullVerify: 0 trasiga bilder, alla kort synliga, alla filter fungerar
- Mobil 375px: layout korrekt, filter collapsar
- Alla bilder renderar (complete && naturalWidth > 0)

## Avgränsningar

- Ingen sökfunktion (frisökning). Filter räcker.
- Ingen användarval av sortering (pris/namn). Bara reverse (senast först).
- Ingen dark/light mode ändring (behålls som den är).
- Ingen ändring av add-item.sh, json-helper.py, orchestrate.sh eller agents.
- Befintligt custom konfetti-system (Confetti.burst/rain, ~80 rader canvas-kod) tas bort helt. Ersätts med canvas-confetti CDN.
- Befintlig confetti-canvas HTML-element tas bort.

## Sammanfattning av produktändringar

| Åtgärd | Antal |
|---|---|
| Ta bort utgångna H&M | -5 |
| Lägg till aktuella H&M (med bilder) | +4 |
| Befintliga produkter får bilder | 6 (H&M marinblå, 3 caps, Etsy, romper) |
| **Resultat** | 80 produkter, alla med bilder |

## PoC-validering

Beslut 4-9 bekräftade via `poc/v1/index.html` (Chrome desktop + 375px mobil, 2026-03-18). 11/11 features fungerar. Se `poc/v1/RESULTAT.md`.
