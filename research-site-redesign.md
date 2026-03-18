# Research: Sajt-redesign

Datum: 2026-03-17
Uppdaterad: 2026-03-17 (verifierade fakta: H&M 403, GSAP gratis, dataanalys)

## 1. Produktbilder för 11 produkter utan bild

### Nuläge

11 produkter visar text-placeholders istället för bilder:
- 6 st H&M (skjorta+fluga-set, väst-set)
- 4 st Accessoarer (flat caps, newsboy caps)
- 1 st Dressade Rompers (waistcoat tuxedo onesie)

64 av 75 produkter har bilder.

### H&M bilder (verifierat 2026-03-17)

**Testat:** Auto-discovery-agenten (OpenCode nemotron-3-super-free) sökte "H&M baby boy 3 piece set bow tie" via websearch, hittade hm.com-sida, försökte webfetch. **Resultat: HTTP 403.** H&M blockerar alla automatiserade hämtningar.

**Testat:** WebFetch direkt mot hm.com. **Resultat: timeout.** Sidan laddar inte alls.

H&M-produkterna har dessutom inga direkta produktlänkar (alla 6 pekade på en samlingssida som vi redan fixat). H&M byter sortiment varje säsong. Dessa 6 produkter representerar inte specifika köpbara artiklar utan kategorier av plagg.

**Tre alternativ:**

| # | Approach | Automatiserbart | Hållbart |
|---|---|---|---|
| A | Hämta bilder manuellt i Chrome | Nej | Nej (bilder blir inaktuella) |
| B | Ta bort H&M-produkterna | Ja | Ja |
| C | Ersätt med snyggare placeholders (CSS-illustrationer istället för text) | Ja | Ja |

### Accessoarer (Born to Love, Amazon, Etsy)

- Born to Love: Amazon-produkter. Bilder tillgängliga via Amazon CDN (`m.media-amazon.com`), ingen anti-bot.
- Etsy-marknadssidor: kan inte hämta specifika produktbilder (sökresultat, inte fasta produkter)
- Newsboy Hat + Suspenders Sets (Etsy): sökresultat-sida. Ingen specifik produktbild.

3 av 4 accessoarer är söksidor utan specifik produkt. Bara Flat Scally Cap (Born to Love/Amazon) har en riktig produktsida.

### Romper (Gentleman Waistcoat Tuxedo Onesie)

Generisk AliExpress-stil produkt. Kan sökas upp via auto-discovery-agenten.

### Sammanfattning bilder

| Grupp | Antal | Bild hämtbar automatiskt? |
|---|---|---|
| H&M | 6 | Nej (403, timeout) |
| Accessoarer (Amazon) | 1 | Ja |
| Accessoarer (Etsy sök) | 3 | Nej (inte specifika produkter) |
| Romper | 1 | Troligen ja (generisk produkt) |
| **Kan fixas automatiskt** | **2** | |
| **Kräver manuellt eller borttagning** | **9** | |

## 2. Platt lista (ta bort sektioner)

### Nuläge

15 sektioner med H2-rubriker, beskrivningar, och taggar. Produktkort grupperade under varje sektion.

### UX-analys: 75 produkter utan gruppering

| Faktor | Med sektioner (nu) | Platt lista |
|---|---|---|
| Överblick | Tydlig: sektionsrubriker segmenterar | Kräver filtrering/sökning |
| Scrollning | Lång (rubriker + beskrivningar tar plats) | Kortare (bara produktkort) |
| Hitta specifik produkt | Svårt (måste veta vilken sektion) | Snabbt med filter/sökning |
| Upptäcka nya produkter | Svårt (nya hamnar i mitten av sektioner) | Tydligt (nya överst) |

**Risk:** Utan sektioner och utan fungerande filter blir sidan oöverskådlig. Filter MÅSTE implementeras samtidigt som sektionerna tas bort.

### Påverkan på kod

- `const SECTIONS` behålls som metadata (filter använder `section`-fältet)
- Rendering-loopen byts till platt
- Sektionsrubriker och beskrivningar tas bort från synlig rendering

## 3. Sortering: senast tillagda först

`add-item.sh` appendar produkter i slutet av PRODUCTS-arrayen. `reverse()` vid rendering ger senast tillagda först.

Inget `added_date`-fält behövs. Om det behövs i framtiden: lägg till i add-item.sh (`date +%Y-%m-%d`), ändra json-helper.py inject-funktion. Marginellt arbete.

## 4. localStorage: spåra sedda produkter

### Schema: URL-baserat

Produktindex ändras om produkter tas bort. URL:er är unika och stabila.

```javascript
const seenUrls = new Set(JSON.parse(localStorage.getItem('vilgot-seen-urls') || '[]'));
const newProducts = PRODUCTS.filter(p => !seenUrls.has(p.url));
// Efter rendering:
localStorage.setItem('vilgot-seen-urls', JSON.stringify(PRODUCTS.map(p => p.url)));
```

### Begränsningar

- 5 MB per domän. 75 URL:er (~5 KB). Inga problem med tusentals produkter.
- Rensas vid browser-datarensning.
- Synkar inte mellan enheter (irrelevant, sajten är för Mikael).
- Första besöket: alla produkter visas som "nya" (acceptabelt).

## 5. Animationer för nya produkter

### GSAP licens (verifierat 2026-03-17)

GSAP är 100% gratis för alla sedan Webflow-sponsringen. Ingen begränsning för personliga eller publika sajter. Källa: gsap.com/pricing/.

### Bibliotek via CDN

| Bibliotek | CDN URL | Storlek |
|---|---|---|
| GSAP 3.13 | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js` | 70 KB |
| GSAP ScrollTrigger | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js` | 25 KB |
| anime.js 4.2 | `https://cdnjs.cloudflare.com/ajax/libs/animejs/4.2.0/anime.min.js` | 17 KB |
| canvas-confetti | Redan i projektet | 0 KB extra |

### Rekommendation: GSAP + canvas-confetti

GSAP för kortanimationer (slide-in, bounce, scale, stagger). canvas-confetti (redan importerad) för partikeleffekter. Kombinationen ger extrem wow-faktor utan extra beroenden.

### Effekter

| Effekt | Teknik | Wow-faktor |
|---|---|---|
| Kort flyger in från sidan | `gsap.from(card, { x: -200, opacity: 0, ease: "back.out(1.7)" })` | Medel |
| Elastic scale bounce | `gsap.from(card, { scale: 0, ease: "elastic.out(1, 0.5)", duration: 1.2 })` | Hög |
| Glow pulse runt kortet | CSS `@keyframes glow { box-shadow: 0 0 5px gold → 0 0 30px gold }` | Hög |
| "NY!" badge med shimmer | CSS gradient-animation + `animation: shimmer 1.5s infinite` | Medel |
| Konfetti per kort | `confetti({ particleCount: 80, origin: { x, y } })` | Extrem |
| Stagger (kort efter kort) | `gsap.from(cards, { y: 50, opacity: 0, stagger: 0.15 })` | Hög (visuell kaskad) |

### Prestanda

75-100 kort: inga problem. GSAP är GPU-optimerad. Regler:
- Animera bara `transform` och `opacity` (GPU-accelererat)
- Undvik `width`, `height`, `margin` (triggrar layout-reflow)
- `will-change: transform` på animerade element
- Animera bara "nya" produkter (inte alla 75)

## 6. Filtrering

### Dataanalys (verifierad 2026-03-17)

**Brands:** 36 unika. 27 har bara 1-2 produkter. 9 har 3+:

| Brand | Antal |
|---|---|
| The Tiny Universe | 8 |
| H&M | 6 |
| Jacadi Paris | 5 |
| Lulu Babe | 4 |
| Feltman Brothers | 4 |
| Cuddle Sleep Dream | 3 |
| Born to Love | 3 |
| Mayoral | 3 |
| Childrensalon | 3 |

Filter-pills för alla 36 brands = oöverskådligt. Visa topp 9 (3+ produkter) + "Övriga" pill.

**Storlekar:** 20 unika strängar. Stor variation i format:
- "Från 3M", "Från 0-3M", "Från 0-3 Months" (samma storlek, tre format)
- "Från NB", "Newborn+", "NB (3-6M)" (alla newborn)
- "Från 56", "Från 62" (europeisk)

Normalisering KRÄVS. Föreslagna storlegsgrupper:

| Grupp | Matchar |
|---|---|
| Prematur | Preemie+, Prematur-24M |
| Newborn | Från NB, Newborn+, NB (3-6M) |
| 0-3M | Från 0-3M, Från 0-3 Months, Från 1M, Från 2-4M |
| 3-6M | Från 3M, Från 3-6M, Från 3-6 Months, Från 3-9M |
| 6M+ | Från 6M, Från 6MO, Från 6-9M |
| 56-62 | Från 56, Från 62 |
| One size | One size |

### Valutor (verifierat 2026-03-17)

| Valuta | Antal produkter | Andel |
|---|---|---|
| SEK (kr) | 70 | 93% |
| USD ($) | 3 | 4% |
| "Varierar" | 2 | 3% |

93% av produkterna har SEK-priser. Prisfilter i SEK fungerar direkt för nästan alla. De 3 USD-produkterna kan konverteras med statisk kurs (1 USD = 10.5 kr). De 2 "Varierar" exkluderas från prisfilter.

### UI-rekommendation

Sticky filter-bar under headern med:
- **Brand:** Pills för topp 9 + "Övriga" (collapse)
- **Storlek:** Pills för normaliserade grupper (7 st)
- **Pris:** Predefined ranges i SEK ("Under 300 kr", "300-700 kr", "Över 700 kr")
- **Bara nya:** Toggle

Aktiva filter visas tydligt med "X" för att ta bort. Antal matchande produkter visas ("23 av 75").

### Filtrering + platt lista: beroende

Platt lista utan filter = oöverskådlig. **Filter och platt lista måste implementeras i samma steg.** Annars försämras UX.

## 7. Kodstruktur

### Nuläge

All HTML, CSS och JavaScript i en enda `index.html` (70 KB). Med filtrering, animationer, localStorage och GSAP växer filen ytterligare.

### Alternativ

| Approach | Fördel | Nackdel |
|---|---|---|
| Allt i index.html (nuvarande) | En fil, enkelt att deploya | Svårt att underhålla vid 100+ KB |
| Bryta ut JS till app.js | Lättare att redigera | Två filer att hantera |
| Bryta ut CSS till style.css | Separation of concerns | Tre filer |

**Rekommendation:** Behåll allt i index.html. Sajten är statisk, deployas via git push, och redigeras av agenter som ändå arbetar med en fil i taget. Komplexiteten motiverar inte uppdelning ännu.

## Evidensluckor

- Exakt vilken kombination av GSAP-effekter som ser bäst ut kräver visuell iteration.
- H&M kan ändra sin blocking-policy. Inte testat med cookies/headers.
- Storleksnormaliseringen kan missa framtida format som agenter lägger till.
