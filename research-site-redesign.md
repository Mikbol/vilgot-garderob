# Research: Sajt-redesign

Datum: 2026-03-17

## 1. Produktbilder för 11 produkter utan bild

### Nuläge

11 produkter visar text-placeholders istället för bilder:
- 6 st H&M (skjorta+fluga-set, väst-set)
- 4 st Accessoarer (flat caps, newsboy caps)
- 1 st Dressade Rompers (waistcoat tuxedo onesie)

### H&M bilder

H&M blockerar scraping aggressivt. WebFetch timear ut på hm.com. Deras bild-CDN (lp2.hm.com, image.hm.com) kräver korrekt produkthash som inte kan gissas.

**Tre sätt att lösa:**

| Approach | Hur | Automatiserbart |
|---|---|---|
| Browser manuellt | Öppna produktsidan i Chrome, högerklicka → spara bild | Nej |
| Auto-discovery-agent | Agenten söker H&M via websearch, hittar produktsidan, extraherar bild-URL via webfetch | Ja, men H&M kan blockera |
| Google Shopping | Sök produktnamnet, hitta bilden via Google Images cache | Delvis (scraping) |

**Rekommendation:** Kör auto-discovery-agenten med H&M-fokuserade söktermer. Om den inte hittar bilderna, hämta manuellt. H&M-produkterna är generiska set (skjorta+fluga) som byts ut varje säsong, så bilderna blir inaktuella ändå.

**Alternativ:** Ta bort H&M-produkterna helt. De har inga direkta produktlänkar och byts ut regelbundet. Ersätt med en "H&M har ofta 3-delat set med fluga, kolla aktuellt sortiment"-text.

### Accessoarer (Born to Love, Etsy)

Born to Love (Amazon): produktsidor finns, bilder kan hämtas via Amazon CDN (m.media-amazon.com). Inga anti-bot-problem för enskilda bilder.

Etsy: marknadssök-sidor, inte specifika produkter. Kan inte hämta bilder automatiskt.

### Romper (Gentleman Waistcoat Tuxedo Onesie)

Generisk AliExpress/Amazon-produkt. Sök produktnamnet, hämta bild från säljarsidan.

### Evidenslucka

Inte testat om auto-discovery-agenten klarar H&M via websearch+webfetch. H&M kan blockera webfetch.

## 2. Platt lista (ta bort sektioner)

### Nuläge

15 sektioner med H2-rubriker, beskrivningar, och taggar. Produktkort grupperade under varje sektion. Rendering sker i JavaScript: loopen itererar SECTIONS-arrayen och renderar produkter per sektion.

### Ändring

Byt rendering från sektion-baserad till platt lista. En enda container, alla produktkort i en ström.

**Påverkan:**
- `const SECTIONS` i index.html kan behållas som metadata (filter behöver veta vilken sektion en produkt tillhör)
- Rendering-loopen byts: istället för `SECTIONS.forEach(s => renderProducts(s))` → `PRODUCTS.forEach(p => renderCard(p))`
- Sektionsrubriker och beskrivningar tas bort från synlig rendering
- `section`-fältet på varje produkt behålls (används för filtrering)

**Risk:** Ingen. Rent visuell ändring. Data förblir intakt.

## 3. Sortering: senast tillagda först

### Approach

Produkter med högst index i PRODUCTS-arrayen lades till senast (add-item.sh appendar). Sortera reversed vid rendering:

```javascript
const sorted = [...PRODUCTS].reverse();
```

**Alternativ:** Lägg till `added_date` per produkt. Mer exakt men kräver ändring i add-item.sh och json-helper.py.

**Rekommendation:** `reverse()` räcker. ID = ordning. Enklast, inget att ändra i add-item.sh.

## 4. localStorage: spåra sedda produkter

### Schema

```javascript
// Spara
const seen = JSON.parse(localStorage.getItem('vilgot-seen') || '[]');
// Vid sidladdning: spara alla nuvarande ID:n
const currentIds = PRODUCTS.map((_, i) => i);
localStorage.setItem('vilgot-seen', JSON.stringify(currentIds));
```

### Detektera nya produkter

```javascript
const previouslySeen = JSON.parse(localStorage.getItem('vilgot-seen') || '[]');
const newProducts = PRODUCTS.filter((_, i) => !previouslySeen.includes(i));
```

### Begränsningar

- localStorage: 5 MB per domän. 75 ID:n som JSON = ~300 bytes. Inga problem ens med 10 000 produkter.
- Rensas om användaren rensar browserdata.
- Synkar inte mellan enheter.

### ID-stabilitet

Problemet: om en produkt tas bort (remove) ändras alla efterföljande index. Bättre: använd produktens URL som ID (unik, stabil).

```javascript
const seenUrls = new Set(JSON.parse(localStorage.getItem('vilgot-seen-urls') || '[]'));
const newProducts = PRODUCTS.filter(p => !seenUrls.has(p.url));
// Efter rendering, spara alla URL:er
localStorage.setItem('vilgot-seen-urls', JSON.stringify(PRODUCTS.map(p => p.url)));
```

**Rekommendation:** URL-baserat. Stabilt även om produkter tas bort eller sorteras om.

## 5. Animationer för nya produkter

### Bibliotek via CDN

| Bibliotek | CDN URL | Storlek | Styrka |
|---|---|---|---|
| GSAP 3.13 | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js` | 70 KB | Professionella animationer, timeline, easing. Branschstandard. |
| GSAP ScrollTrigger | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js` | 25 KB | Scroll-baserade triggers. |
| anime.js 4.2 | `https://cdnjs.cloudflare.com/ajax/libs/animejs/4.2.0/anime.min.js` | 17 KB | Lättvikt, enkel API, bra för sekvenser. |
| canvas-confetti | Redan i projektet | - | Konfetti-effekter. |

### Rekommendation: GSAP

GSAP är det bästa valet. Professionellt, pålitligt, extremt flexibelt. Gratis för icke-kommersiellt bruk (sajten är personlig). Kan göra allt: slide-in, scale, glow, bounce, stagger, 3D transforms.

### Effekter (alla möjliga med GSAP + CSS)

| Effekt | Teknik |
|---|---|
| Kort flyger in från sidan | `gsap.from(card, { x: -200, opacity: 0, duration: 0.8, ease: "back.out(1.7)" })` |
| Glow/pulse runt kortet | CSS `box-shadow` animation + `@keyframes glow { 0% { box-shadow: 0 0 5px gold } 50% { box-shadow: 0 0 30px gold } }` |
| "NY!" badge med shimmer | CSS gradient-animation: `background: linear-gradient(90deg, transparent, white, transparent); animation: shimmer 1.5s infinite;` |
| Konfetti vid första visningen | `confetti({ particleCount: 100, origin: { x: cardX, y: cardY } })` |
| Stagger (kort efter kort) | `gsap.from(cards, { y: 50, opacity: 0, stagger: 0.1, duration: 0.6 })` |
| Scale bounce | `gsap.from(card, { scale: 0, ease: "elastic.out(1, 0.5)", duration: 1.2 })` |

### Prestanda

75-100 kort med GSAP-animationer: inga problem. GSAP är optimerad för detta. Använd `will-change: transform` i CSS och undvik animering av `width`/`height` (triggrar layout). `transform` och `opacity` är GPU-accelererade.

### Evidenslucka

Inte testat exakt vilken kombination av effekter som ser bäst ut. Det kräver visuell iteration.

## 6. Filtrering

### UI-mönster

| Mönster | Bäst för | Mobil | Komplexitet |
|---|---|---|---|
| Filter-pills (knappar ovanför listan) | Få filter-värden per kategori | Bra (wrapping) | Låg |
| Sidebar | Många filter, desktop-fokus | Kräver slide-in/overlay | Medel |
| Dropdown per filterkategori | Begränsat utrymme | OK | Låg |
| Sticky top-bar med pills | Alltid synlig | Bra | Medel |

**Rekommendation:** Sticky top-bar med filter-pills för brand, typ, storlek. Prisintervall som predefined ranges ("Under 300 kr", "300-700 kr", "Över 700 kr"). Kombinerbara: klicka flera pills. Aktiva filter visas tydligt.

### Implementation

```javascript
// Filterstate
const filters = { brand: null, type: null, size: null, priceRange: null, onlyNew: false };

// Filtrera
function applyFilters() {
  const filtered = PRODUCTS.filter(p => {
    if (filters.brand && p.brand !== filters.brand) return false;
    if (filters.size && !p.size?.includes(filters.size)) return false;
    if (filters.onlyNew && !isNew(p)) return false;
    if (filters.priceRange && !inPriceRange(p, filters.priceRange)) return false;
    return true;
  });
  renderProducts(filtered);
}
```

### Prisjämförelse med blandade valutor

Produkterna har priser i kr, USD, GBP, EUR, AUD. Filtrering på pris kräver konvertering. Två alternativ:

| Approach | Fördel | Nackdel |
|---|---|---|
| Konvertera allt till SEK vid rendering | Exakt filtrering | Behöver växelkurser (statiska eller API) |
| Visa prisintervall per valuta | Enkelt | Förvirrande UX |

**Rekommendation:** Statiska ungefärliga kurser (1 USD = 10.5 kr, 1 GBP = 13.2 kr, etc.) hårdkodade i JS. Tillräckligt för filtrering. Inte exakt men funktionellt.

### Filtervärden: dynamiska

Extrahera automatiskt från PRODUCTS-arrayen:
```javascript
const brands = [...new Set(PRODUCTS.map(p => p.brand).filter(Boolean))];
const types = [...new Set(PRODUCTS.map(p => p.section).filter(Boolean))];
```

Filtren uppdateras automatiskt när nya produkter läggs till av agenter.

### Prestanda

75-100 produkter: DOM show/hide är snabbare än re-render. Sätt `display: none` på filtrerade produkter istället för att bygga om DOM.

### Motargument

- **Komplexitet:** Filtrering + sortering + animationer + localStorage i en enda HTML-fil blir svårt att underhålla. Överväg att bryta ut JS till en separat fil.
- **Prisjämförelse:** Statiska kurser blir inaktuella. Men för filtrering (inte exakt beräkning) spelar det liten roll.
