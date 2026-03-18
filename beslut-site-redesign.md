# Beslut: Sajt-redesign

Datum: 2026-03-18
Research: `research-site-redesign.md`
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

## 5. Sortering

**Beslut: `[...PRODUCTS].reverse()` vid rendering.**

Inget `added_date`-fält. Index = tillagd ordning, reverse = senast först. Om det behövs i framtiden kan `added_date` läggas till utan att bryta befintlig data.

## 6. localStorage

**Beslut: URL-baserat schema.**

Spara sedda produkt-URL:er i `vilgot-seen-urls`. URL:er är unika och stabila även om produkter tas bort. Första besöket: alla visas som "nya" (acceptabelt).

## 7. Animationer

**Beslut: GSAP 3.13 via CDN + befintlig canvas-confetti.**

GSAP är gratis (Webflow-sponsrat), 70 KB, branschstandard. Effekter för nya produkter:
- Elastic scale bounce (kort poppar upp)
- Glow pulse (CSS box-shadow)
- Stagger (kort efter kort i kaskad)
- Konfetti per nytt kort (canvas-confetti redan importerad)
- "NY!" badge med shimmer-animation

Animeras bara vid första sidladdningen för produkter som inte finns i localStorage. Markeras som "sedda" efter animering.

## 8. Filtrering

**Beslut: Sticky filter-bar med pills.**

- **Brand:** Topp 9 (3+ produkter) som pills + "Övriga" som expanderbar grupp
- **Storlek:** 7 normaliserade grupper (Prematur, Newborn, 0-3M, 3-6M, 6M+, 56-62, One size)
- **Pris:** 3 predefined ranges i SEK ("Under 300 kr", "300-700 kr", "Över 700 kr"). USD-priser konverteras med statisk kurs 1 USD = 10.5 kr. "Varierar" exkluderas.
- **Bara nya:** Toggle
- Antal matchande visas ("23 av 75")
- Aktiva filter med "X" för att ta bort

## 9. Kodstruktur

**Beslut: Behåll allt i index.html.**

Sajten redigeras av agenter (add-item.sh), deployas via git push. En fil är enklast. Uppdelning motiveras inte vid nuvarande storlek.

## Sammanfattning av produktändringar

| Åtgärd | Antal |
|---|---|
| Ta bort utgångna H&M | -5 |
| Lägg till aktuella H&M (med bilder) | +4 |
| Befintliga produkter får bilder | 6 (H&M marinblå, 3 caps, Etsy, romper) |
| **Resultat** | 74 produkter, alla med bilder |
