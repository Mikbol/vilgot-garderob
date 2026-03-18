# Plan: Sajt-redesign implementation

Skapad: 2026-03-18
Beslut: `beslut-site-redesign.md`
PoC: `poc/v1/` (bekräftad)

## Mål

Skriva om rendering-logiken i index.html: platt lista, reverse-sortering, localStorage, GSAP-animationer, filter-pills. Alla 80 produkter med bilder, inga sektionsrubriker.

## Steg 1: Lägg till GSAP och förbered JS-struktur

Lägg till GSAP CDN-import i `<head>` (canvas-confetti finns redan):

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
```

**Verifiering:** `typeof gsap` i browser console → `"object"`.

**Tid:** 1 min.

## Steg 2: Implementera localStorage

Lägg till i JavaScript (före rendering):

```javascript
const SEEN_KEY = 'vilgot-seen-urls';
const seenUrls = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
function isNewProduct(p) { return !seenUrls.has(p.url); }
function saveSeen() {
  localStorage.setItem(SEEN_KEY, JSON.stringify(PRODUCTS.map(p => p.url)));
}
```

Anropa `saveSeen()` 3 sekunder efter sidladdning (efter animationer kört klart).

**Verifiering:** Öppna sajten → alla "nya" → ladda om → inga "nya". Rensa localStorage → alla "nya" igen.

**Tid:** 5 min.

## Steg 3: Byt rendering till platt lista med reverse-sortering

Ersätt nuvarande sektionsbaserade rendering-loop med:

```javascript
function renderProducts(products) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const sorted = [...products].reverse(); // senast tillagda först
  sorted.forEach(p => {
    const isNew = isNewProduct(p);
    // ... skapa produktkort (samma HTML-struktur som nu, men utan sektionsrubriker)
    // Lägg till class "new-product" om isNew
    // Lägg till NY!-badge om isNew
  });
}
```

Ta bort:
- `SECTIONS.forEach(...)` rendering-loopen
- Sektionsrubriker (`<h2>`)
- Sektionsbeskrivningar
- Sektionstaggar

Behåll:
- `const SECTIONS` (metadata, används av filter)
- `section`-fältet på varje produkt
- All befintlig CSS för produktkort

**Verifiering:** Sajten visar alla 80 produkter i en ström. Senast tillagda produkter (auto-discovery) syns överst. Inga sektionsrubriker synliga.

**Tid:** 15 min.

## Steg 4: Implementera filter-bar

Lägg till HTML ovanför grid:

```html
<div class="filter-bar">
  <button class="filter-toggle" onclick="toggleFilters()">Filter</button>
  <div class="filter-groups" id="filterGroups">
    <!-- Brand pills: genereras dynamiskt -->
    <div class="filter-group" id="brandFilters"></div>
    <!-- Storlek pills: normaliserade grupper -->
    <div class="filter-group" id="sizeFilters"></div>
    <!-- Pris pills -->
    <div class="filter-group" id="priceFilters"></div>
    <!-- Bara nya toggle -->
    <div class="filter-group" id="newFilter"></div>
  </div>
  <span class="filter-count" id="filterCount"></span>
</div>
```

JavaScript:

```javascript
const filters = { brand: 'all', size: 'all', price: 'all', onlyNew: false };

// Brand pills: dynamiska, topp 9 + "Övriga"
function initBrandFilters() {
  const counts = {};
  PRODUCTS.forEach(p => { counts[p.brand] = (counts[p.brand] || 0) + 1; });
  const top = Object.entries(counts).filter(([_, c]) => c >= 3).sort((a, b) => b[1] - a[1]);
  // Generera pills...
}

// Storlek: normaliserade grupper
const SIZE_GROUPS = {
  'Prematur': ['Preemie+', 'Prematur-24M'],
  'Newborn': ['Från NB', 'Newborn+', 'NB (3-6M)'],
  '0-3M': ['Från 0-3M', 'Från 0-3 Months', 'Från 1M', 'Från 2-4M'],
  '3-6M': ['Från 3M', 'Från 3-6M', 'Från 3-6 Months', 'Från 3-9M'],
  '6M+': ['Från 6M', 'Från 6MO', 'Från 6-9M'],
  '56-62': ['Från 56', 'Från 62'],
  'One size': ['One size'],
};

// Pris: parsning + konvertering
function parsePrice(priceStr) {
  const num = parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
  if (priceStr.includes('USD') || priceStr.includes('$')) return num * 10.5;
  if (priceStr.includes('GBP') || priceStr.includes('£')) return num * 13.2;
  if (priceStr.includes('EUR') || priceStr.includes('€')) return num * 11.5;
  return num; // SEK
}

function applyFilters() {
  const cards = document.querySelectorAll('.card');
  let visible = 0;
  cards.forEach(card => {
    const p = PRODUCTS[card.dataset.idx];
    const show =
      (filters.brand === 'all' || p.brand === filters.brand) &&
      (filters.size === 'all' || matchSize(p.size, filters.size)) &&
      (filters.price === 'all' || matchPrice(p.price, filters.price)) &&
      (!filters.onlyNew || isNewProduct(p));
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('filterCount').textContent = `${visible} av ${PRODUCTS.length}`;
}
```

CSS: sticky filter-bar, pills, mobil collapse (se PoC för exakt CSS).

**Verifiering:**
- Klicka brand-pill → bara den brandens produkter visas
- Klicka storlek-pill → filtrerar korrekt
- Klicka pris-pill → filtrerar korrekt (inkl. USD-konvertering)
- "Bara nya" → visar bara osedda produkter
- Kombinera brand + storlek → intersection fungerar
- Mobil 375px → filter collapsar till "Filter"-knapp
- Räknare visar korrekt ("X av 80")

**Tid:** 30 min.

## Steg 5: Implementera animationer

Lägg till CSS för glow och shimmer (se PoC). Lägg till JS efter rendering:

```javascript
function animateNewProducts() {
  const newCards = document.querySelectorAll('.card.new-product:not(.hidden)');
  if (newCards.length === 0) return;

  gsap.from(newCards, {
    scale: 0, opacity: 0, duration: 1,
    ease: "elastic.out(1, 0.5)",
    stagger: 0.15,
    onComplete: () => newCards.forEach(c => c.classList.add('glow'))
  });

  newCards.forEach((card, i) => {
    setTimeout(() => {
      const rect = card.getBoundingClientRect();
      confetti({
        particleCount: 60, spread: 50,
        origin: { x: (rect.left + rect.width/2) / window.innerWidth, y: (rect.top + rect.height/2) / window.innerHeight },
        colors: ['#d4a84b', '#ff6b6b', '#fff']
      });
    }, i * 200 + 500);
  });
}
```

NY!-badge: `<span class="new-badge shimmer">NY!</span>` på varje nytt kort.

Anropa `animateNewProducts()` 300ms efter DOMContentLoaded. Anropa `saveSeen()` 3s efter.

**Verifiering:**
- Första besöket: alla kort animeras (elastic bounce + glow + konfetti)
- Ladda om: inga animationer (alla sedda)
- Rensa localStorage + ladda om: animationer igen
- Kör auto-discovery → ladda om: bara nya produkter animeras

**Tid:** 15 min.

## Steg 6: Commit och push

```bash
cd /Users/bolm/AI-Assistent/vilgot-kläder/site
git add index.html
git commit -m "feat: sajt-redesign (platt lista, filter, GSAP-animationer, localStorage)"
git push origin main
```

**Tid:** 1 min.

## Steg 7: Vänta på Pages build

```bash
for i in 1 2 3 4 5; do
  STATUS=$(gh api repos/Mikbol/vilgot-garderob/pages --jq '.status')
  echo "Försök $i: $STATUS"
  [ "$STATUS" = "built" ] && break
  sleep 30
done
```

**Tid:** 1-3 min.

## Steg 8: Verifiera live-sajt (OBLIGATORISK, alla delar)

### 8a. Fullständig sajt-verifiering (Chrome, OBLIGATORISK)

Navigera till live-sajten. Scrolla hela sidan (dubbelt). Kör fullVerify():

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

  return JSON.stringify({
    totalImages: imgs.length,
    broken: broken.length,
    brokenList: broken,
    totalCards: document.querySelectorAll('.card').length,
    sectionHeaders: document.querySelectorAll('h2').length
  });
}
fullVerify();
```

Pass: 0 trasiga bilder, 80 produktkort, 0 sektionsrubriker (h2 borde vara 0 eller bara sidtiteln).

### 8b. Filter-verifiering (Chrome)

```javascript
// Testa brand-filter
document.querySelector('[data-filter="brand"][data-value="H&M"]').click();
document.querySelectorAll('.card:not(.hidden)').length;
// Förväntat: 5 (H&M har 5 produkter)
```

Återställ till "Alla" och testa storlek, pris, "Bara nya".

### 8c. Animations-verifiering (Chrome)

Rensa localStorage och ladda om:
```javascript
localStorage.removeItem('vilgot-seen-urls');
location.reload();
```
Ta screenshot: NY!-badges synliga, kort animerade.

### 8d. Mobil-verifiering (Chrome)

Resize till 375x812. Ta screenshot. Filter collapsar. Grid 2 kolumner eller 1.

### 8e. Visuell granskning

Scrolla genom hela sidan och ta screenshots var 5:e scroll. Bekräfta att:
- Alla produktbilder visar rätt plagg
- Inga tomma kort eller trasiga layouts
- Priser och storlekar syns korrekt

**Om Chrome inte är anslutet:** Vänta. Denna verifiering kan INTE hoppas över.

**Tid:** 15 min.

## Steg 9: Uppdatera dokument

- `task-site-redesign.md`: markera punkt 2-6 som ✅, status → KLAR
- `beslut-site-redesign.md`: notera implementation genomförd
- `STATUS.md` (vilgot-kläder): uppdatera
- `plan-site-redesign.md`: resultat per steg

**Tid:** 3 min.

## Rollback

```bash
git revert HEAD
git push origin main
```

## Total tid

| Steg | Tid |
|------|-----|
| 1. GSAP CDN | 1 min |
| 2. localStorage | 5 min |
| 3. Platt lista + sortering | 15 min |
| 4. Filter-bar | 30 min |
| 5. Animationer | 15 min |
| 6. Commit + push | 1 min |
| 7. Pages build | 1-3 min |
| 8. Verifiera live (Chrome fullständig) | 15 min |
| 9. Dokument | 3 min |
| **Total** | **86-88 min** |
