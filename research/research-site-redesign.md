# Research: Sajt-redesign

Datum: 2026-03-17
Uppdaterad: 2026-03-18 (alternativ kompletterade, källor, motbevis, evidensluckor, fakta/slutledning, PoC krävs)

## 1. Produktbilder för 11 produkter utan bild

### Nuläge

11 produkter visar text-placeholders istället för bilder:
- 6 st H&M (skjorta+fluga-set, väst-set)
- 4 st Accessoarer (flat caps, newsboy caps)
- 1 st Dressade Rompers (waistcoat tuxedo onesie)

64 av 75 produkter har bilder.

### H&M bilder (verifierat 2026-03-18)

**Testat:**
- Auto-discovery-agenten (websearch+webfetch): **HTTP 403**. Kan inte hämta.
- WebFetch direkt mot hm.com: **timeout**.
- Chrome-automation: **fungerar**. Produktsidor laddas, bilder extraheras via JS.
- 5 av 6 H&M-produkter (ID 19, 21, 22, 23, 24): **redirectar till startsidan** (utgångna).
- 1 H&M-produkt (ID 20, marinblå dressat set): **finns kvar**, bild hämtad.
- Sökning "baby skjorta dressat kostym" på H&M: **4 aktuella gentleman-set** hittade (349-499 kr).

**Lösning:** Ersätt 5 utgångna med 4 aktuella. Bilder hämtade via Chrome.

| Ny produkt | Pris | Artikelnr |
|---|---|---|
| 4-delat dressat set i linmix (Ljusbeige) | 349 kr | 1292410004 |
| 4-delat dressat set i linmix (Khakigrön) | 349 kr | 1292410005 |
| 4-delat kostymset (Ljusbeige) | 499 kr | 1242064002 |
| 4-delat dressat set i linmix (Vit/Blå) | 349 kr | 1292410001 |

### Accessoarer (verifierat 2026-03-18)

Alla 4 bilder hämtade via Chrome:
- Born to Love Flat Scally Cap: Amazon CDN, `#landingImage` data-old-hires
- Born to Love Tweed Driver Cap: Amazon CDN
- Born to Love Herringbone Newsboy: Amazon CDN
- Newsboy Hat + Suspenders (Etsy söksida): första sökresultatets bild, uppskallad till 794px

### Romper (verifierat 2026-03-18)

Gentleman Waistcoat Tuxedo Onesie: bild hämtad via Amazon CDN (`#landingImage`).

### Sammanfattning bilder

| Grupp | Antal | Bild hämtad? |
|---|---|---|
| H&M befintlig (marinblå) | 1 | Ja (Chrome) |
| H&M utgångna → ersatta med aktuella | 5 → 4 | Ja (Chrome) |
| Accessoarer (Amazon) | 3 | Ja (Chrome) |
| Accessoarer (Etsy sök) | 1 | Ja (Chrome, representativ) |
| Romper (Amazon) | 1 | Ja (Chrome) |
| **Alla 11 lösta** | **10 bilder** | |

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

### Alternativ

| # | Approach | Fördel | Nackdel |
|---|---|---|---|
| A | Platt lista (alla kort i en ström) | Enklast. Nya produkter syns direkt överst. Filtrering styr allt. | Ingen visuell gruppering. Kräver filter. |
| B | Collapsible sektioner (klicka för att fälla ihop) | Behåller gruppering men sparar plats | Komplexare JS. Nya produkter hamnar i mitten av sektioner. |
| C | Tagg-baserad gruppering (filtrera på sektion som tagg) | Flexibelt, användaren väljer gruppering | Kräver filter-UI som redan planeras. Egentligen samma som platt lista + filter. |

**Motargument mot A (platt lista):** Förlorar överblick per brand. Användaren som vill se "allt från The Tiny Universe" måste använda filter istället för att scrolla till sektionen. Minskar casual browsing-upplevelsen.

Alternativ B löser inte huvudproblemet (nya produkter syns inte) och lägger till komplexitet. Alternativ C är funktionellt identiskt med A + filtrering.

### Påverkan på kod

- `const SECTIONS` behålls som metadata (filter använder `section`-fältet)
- Rendering-loopen byts till platt
- Sektionsrubriker och beskrivningar tas bort från synlig rendering

## 3. Sortering

### Alternativ

| # | Approach | Fördel | Nackdel |
|---|---|---|---|
| A | Bara reverse (senast tillagda först) | Enklast. 1 rad JS. Inget nytt fält. | Användaren kan inte välja sortering. |
| B | Användarval: senast/pris/namn/brand | Flexibelt. Standard i e-handel. | Kräver sorteringslogik + UI (dropdown). Prissortering kräver valutanormalisering. |
| C | reverse() + `added_date` per produkt | Exakt datum synligt. Kan visa "Tillagd 2026-03-18". | Kräver ändring i add-item.sh och json-helper.py. |

Prissortering (alternativ B) kompliceras av blandade valutor (93% SEK, 4% USD, 3% "Varierar"). Kräver parsning och konvertering.

**Motargument mot A (bara reverse):** Användaren kan aldrig se billigaste produkten först. Med 80+ produkter och blandade priser (100-7000 kr) är prissortering användbart. Motargumentet väger tungt om sajten ska användas för att köpa (jämföra priser), men mindre om syftet är inspiration (se vad som finns).

`add-item.sh` appendar produkter i slutet av PRODUCTS-arrayen. `reverse()` vid rendering ger senast tillagda först utan nya fält.

## 4. localStorage: spåra sedda produkter

### Alternativ schema

| # | Schema | ID-typ | Stabilitet vid remove | Storlek per produkt |
|---|---|---|---|---|
| A | URL-baserat | Produktens URL | Stabil (URL ändras inte vid remove) | ~80 bytes |
| B | Index-baserat | Position i PRODUCTS-arrayen | Instabil (alla index ändras vid remove) | ~4 bytes |
| C | Hash av namn+brand+url | SHA-liknande hash | Stabil, men kolliderar om namn ändras | ~32 bytes |
| D | URL + timestamp | URL + senast sedd | Stabil + kan visa "sedd för 3 dagar sedan" | ~90 bytes |

Alternativ B är enklast men havererar om en produkt tas bort (alla efterföljande produkter markeras som "nya"). Alternativ D ger mest data men timestamp tillför lite värde för Mikael (bryr sig om ny/inte ny, inte när). Alternativ A är bäst: stabilt, enkelt, tillräckligt.

**Motargument mot A (URL-baserat):** Om en butik ändrar sin URL-struktur (t.ex. redirect) blir produkten "ny" igen trots att den setts förut. Risk: låg (URL:er ändras sällan och vi lagrar den URL som finns i PRODUCTS, inte den som butiken redirectar till).

```javascript
const seenUrls = new Set(JSON.parse(localStorage.getItem('vilgot-seen-urls') || '[]'));
const newProducts = PRODUCTS.filter(p => !seenUrls.has(p.url));
// Efter rendering:
localStorage.setItem('vilgot-seen-urls', JSON.stringify(PRODUCTS.map(p => p.url)));
```

### Begränsningar

- 5 MB per domän (källa: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API#storage_limits). 75 URL:er (~5 KB). Inga problem med tusentals produkter.
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

### Alternativ

| # | Approach | Storlek | Styrka | Nackdel |
|---|---|---|---|---|
| A | GSAP + canvas-confetti | 70 KB + 0 (redan importerad) | Branschstandard, alla effekter, timeline, easing | Störst |
| B | anime.js + canvas-confetti | 17 KB + 0 | Lättvikt, enkel API (källa: https://animejs.com/documentation/) | Färre inbyggda easing-funktioner än GSAP (källa: animejs.com vs gsap.com/docs/v3/Eases) |
| C | Bara CSS @keyframes + canvas-confetti | 0 KB extra | Ingen dependency | Begränsat: ingen stagger, ingen timeline, ingen elastic ease |
| D | Inga animationer | 0 KB | Snabbast laddtid | Ingen wow-faktor (Mikael sa "extrema animationer") |
| E | Motion One (motionone.org) | 18 KB | Modern, Web Animations API | Mindre community, färre exempel. Källa: motionone.org |

**Motargument mot A (GSAP):** 70 KB är lika stort som hela nuvarande index.html. Fördubblar JS-storleken. anime.js (17 KB) ger de flesta effekter med 75% mindre storlek. CSS-only (0 KB) räcker för glow och shimmer men saknar stagger och elastic easing.

GSAP + canvas-confetti ger mest wow-faktor. canvas-confetti redan importerad i projektet.

### Effekter

| Effekt | Teknik | Wow-faktor |
|---|---|---|
| Kort flyger in från sidan | `gsap.from(card, { x: -200, opacity: 0, ease: "back.out(1.7)" })` | Medel |
| Elastic scale bounce | `gsap.from(card, { scale: 0, ease: "elastic.out(1, 0.5)", duration: 1.2 })` | Hög |
| Glow pulse runt kortet | CSS `@keyframes glow { box-shadow: 0 0 5px gold → 0 0 30px gold }` | Hög |
| "NY!" badge med shimmer | CSS gradient-animation + `animation: shimmer 1.5s infinite` | Medel |
| Konfetti per kort | `confetti({ particleCount: 80, origin: { x, y } })` (källa: https://github.com/catdad/canvas-confetti) | Extrem |
| Stagger (kort efter kort) | `gsap.from(cards, { y: 50, opacity: 0, stagger: 0.15 })` | Hög (visuell kaskad) |

### Prestanda

75-100 kort: inga problem. GSAP använder `requestAnimationFrame` och optimerar för GPU-compositing (källa: https://gsap.com/docs/v3/). Regler:
- Animera bara `transform` och `opacity` (GPU-composited, undviker layout/paint. Källa: https://web.dev/articles/animations-guide)
- Undvik `width`, `height`, `margin` (triggrar layout-reflow)
- `will-change: transform` på animerade element (källa: https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)
- Animera bara "nya" produkter (inte alla 80)

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

### UI-alternativ

| # | Approach | Fördel | Nackdel |
|---|---|---|---|
| A | Filter-pills (knappar) | Visuellt tydligt, snabbt att klicka | Tar plats med 36 brands. Kräver "Övriga"-collapse. |
| B | Sökbar dropdown per kategori | Skalbart, funkar med 100+ brands | Mer klick (öppna dropdown, söka, välja). Mindre discoverable. |
| C | Faceted search (sidebar med checkboxar) | Standard i e-handel (Zalando, Amazon) | Tar mycket horisontell plats. Kräver responsiv layout. Desktop-fokus. |
| D | Frisökning (ett sökfält som filtrerar namn+brand+sektion) | Enklast, 1 input-fält | Kräver att användaren vet vad den söker. Inget browsing-stöd. |
| E | Prisslider (range input) | Exakt prisval, visuellt tydligt | Komplicerat med blandade valutor. `<input type="range">` kräver min/max. |
| F | Predefined prisintervall (pills) | Enkelt, inga slider-problem | Mindre flexibelt. Intervallgränserna kan kännas godtyckliga. |

Källa för faceted search: https://www.nngroup.com/articles/faceted-search/ (Nielsen Norman Group, UX-research).

### UI-rekommendation

Sticky filter-bar under headern med:
- **Brand:** Pills för topp 9 + "Övriga" (collapse)
- **Storlek:** Pills för normaliserade grupper (7 st)
- **Pris:** Predefined ranges i SEK ("Under 300 kr", "300-700 kr", "Över 700 kr")
- **Bara nya:** Toggle

Aktiva filter visas tydligt med "X" för att ta bort. Antal matchande produkter visas ("23 av 75").

**Motargument mot filter-pills:** 36 brands i pills = oöverskådligt. Topp 9 + "Övriga" döljer 27 brands. Alternativ: sökbar dropdown för brand (skriver "Tiny" → filtrerar). Mer komplex men skalbar.

### Filtrering + platt lista: beroende

Platt lista utan filter = oöverskådlig. **Filter och platt lista måste implementeras i samma steg.** Annars försämras UX.

## 7. Kodstruktur

### Nuläge

All HTML, CSS och JavaScript i en enda `index.html` (70 KB). Med filtrering, animationer, localStorage och GSAP växer filen ytterligare.

### Alternativ

| # | Approach | Fördel | Nackdel |
|---|---|---|---|
| A | Allt i index.html (nuvarande) | En fil, enkelt att deploya, agenter redigerar en fil | Svårt att underhålla vid 100+ KB |
| B | Bryta ut JS till app.js | Lättare att redigera JS | Två filer. add-item.sh modifierar index.html, inte app.js. |
| C | Bryta ut CSS till style.css + JS till app.js | Separation of concerns | Tre filer att hantera. Agenter måste koordinera. |
| D | ES modules (`<script type="module" src="app.mjs">`) | Modern, importerbara moduler, tree-shakeable | GitHub Pages serverar .mjs korrekt. Men add-item.sh injekterar i index.html. |
| E | Web Components | Enkapsulerade produktkort | Massiv overengineering för 80 produkter. |

add-item.sh och json-helper.py manipulerar PRODUCTS-arrayen i index.html. json-helper.py söker efter `const PRODUCTS = ` via regex och injekterar JSON. Den bryr sig inte om övrig filinnehåll.

### Hybrid-approach (ny research 2026-03-18)

PRODUCTS + SECTIONS kvar i index.html (~1450 rader, ~46 KB). All rendering-logik i `app.js` (~300 rader, ~10 KB). CSS i `style.css` (~750 rader, ~20 KB).

**Fördelar:**
- add-item.sh/json-helper.py behöver INTE ändras (PRODUCTS är kvar i index.html)
- Claude kan redigera app.js utan att behöva ladda 1450 rader produktdata i context
- CSS-ändringar isolerade i style.css
- index.html krymper till ~1500 rader (data + minimal HTML)

**Nackdelar:**
- 3 filer istället för 1. Men deployas identiskt (git push, GitHub Pages serverar statiska filer).

### Filstorlek och context window

| Fil | Rader | Problem för Claude |
|---|---|---|
| index.html (nu) | 2541 | Ja: hela filen måste läsas för att ändra rendering. PRODUCTS tar 1270 rader context som inte behövs. |
| index.html (hybrid) | ~1500 | Bättre. Men fortfarande 1270 rader produktdata. |
| app.js (hybrid) | ~300 | Claude redigerar bara detta. Hela filen i context. |

**Fakta:** Claude Code Edit-verktyget arbetar med string-matching. Stora filer gör det svårare att hitta unika strängar. Med 2541 rader ökar risken för edit-kollisioner.

**Slutsats:** Hybrid (PRODUCTS i index.html, rendering i app.js, CSS i style.css) löser context-problemet utan att bryta add-item.sh. Beslutet i sektion 7 ("behåll allt i index.html") bör revideras.

## 8. PoC krävs

Animationer och filter-UI kan inte bedömas via research. En PoC ska testa:
- GSAP elastic bounce + glow + stagger på 5 produktkort
- Filter-pills (brand, storlek, pris) med kombinerbara filter
- localStorage: markera "nya" produkter, visa badge
- Mobil-responsivitet (375px viewport)

PoC-filen: `poc/v1/index.html` (fristående, laddar GSAP från CDN, 5 hårdkodade produkter).

### PoC-resultat (2026-03-18)

PoC testad live i Chrome (desktop + 375px mobil). Alla 11 features fungerar. Se `poc/v1/RESULTAT.md` för detaljer.

**Besvarade frågor:**
- GSAP levererar wow-faktor (elastic bounce + stagger + konfetti). CSS-only räcker inte.
- Filter-pills fungerar för storlek+pris. Brand behöver collapse/dropdown vid 36 brands.
- localStorage URL-baserat fungerar korrekt.
- Mobil 375px: filter collapsar, 2-kolumns grid, acceptabelt.

**Kvarstående (inte testat i PoC):** Prestanda med 80 kort, storleksnormalisering med riktiga 20 format, filter+animation-interaktion.

## Evidensluckor

- **GSAP-effektval:** Exakt vilken kombination av effekter som ser bäst ut kräver visuell iteration. Kan inte avgöras via research. Lösning: implementera 2-3 effekter, testa visuellt, justera.
- **H&M blocking:** H&M kan ändra sin policy. Inte testat med cookies/headers. Låg risk (bilder redan nedladdade lokalt).
- **Storleksnormalisering:** Kan missa framtida format som agenter lägger till. Lösning: fallback-grupp "Övrigt" för okända format.
- **Mobil-UX för filter (ny):** Sticky filter-bar med pills kan ta för mycket vertikal plats på mobil (375px viewport). Inte testat. Alternativ: collapsible filter-bar som fälls ihop till en "Filter"-knapp på mobil. Kräver CSS media query `@media (max-width: 768px)`.
- **GSAP laddtidspåverkan:** index.html är 69 KB. GSAP 3.13 min är 70 KB. Totalt 139 KB HTML+JS (exkl. bilder). GSAP laddas från CDN (cdnjs.cloudflare.com) och cachas efter första besök. Första laddning: +70 KB. Påverkan: försumbar på bredband (~50ms), märkbar på 3G (~500ms). Sajten används primärt av Mikael på WiFi. Acceptabelt.
- **add-item.sh kompatibilitet:** add-item.sh och json-helper.py injekterar produkter i `const PRODUCTS = [...]` i index.html. Om rendering-logiken bryts ut till app.js måste PRODUCTS-arrayen fortfarande ligga i index.html (eller skripten ändras). Om sektioner tas bort: add-item.sh har `--section` flagga och `VALID_SECTIONS` whitelist. Sektionerna behålls som metadata (filterfält), men rendering ignorerar dem. Ingen ändring i add-item.sh krävs.
- **Auto-discovery i platt lista:** Agenter lägger till produkter med `--section`. I platt lista renderas produkten utan sektionsrubrik men section-fältet finns kvar för filtrering. Agenter behöver inte ändras. Nya produkter hamnar sist i PRODUCTS-arrayen, visas först med reverse().

## Fakta vs slutledning vs spekulation

| Påstående | Typ |
|---|---|
| GSAP är 100% gratis | Fakta (gsap.com/pricing) |
| localStorage 5 MB gräns | Fakta (MDN) |
| 93% SEK-priser | Fakta (vår data, 2026-03-17) |
| `transform`/`opacity` är GPU-composited | Fakta (web.dev) |
| GSAP-prestanda räcker för 80 kort | Rimlig slutledning (GSAP hanterar tusentals element i demos) |
| Platt lista kräver filter | Rimlig slutledning (80 ogrupperade kort är oöverskådligt) |
| Statiska växelkurser räcker | Rimlig slutledning (bara 3 USD-produkter av 80) |
| Mobil filter-bar kan ta för mycket plats | Spekulation (inte testat) |
| anime.js har färre easing-funktioner än GSAP | Fakta (animejs.com/documentation vs gsap.com/docs/v3/Eases) |
| URL:er i localStorage är stabila vid remove | Fakta (vi lagrar URL från PRODUCTS, inte live-URL) |
| URL:er kan ändras vid butiks-redirect | Rimlig slutledning (låg risk, sällan) |
| Faceted search är standard i e-handel | Fakta (NNGroup: nngroup.com/articles/faceted-search/) |
| add-item.sh påverkas inte av platt lista | Fakta (section-fältet behålls, rendering ignorerar det) |
