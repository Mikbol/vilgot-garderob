/* ===========================================================================
 * Vilgots Garderob — app.js
 * ---------------------------------------------------------------------------
 * Static lookbook front-end. Reads the inline `PRODUCTS` array from
 * index.html and renders the catalogue + interactions + effects.
 *
 * Sections:
 *   1. Constants
 *   2. Easings & timing helpers
 *   3. Pure utilities (no DOM)
 *   4. Size-note domain (Vilgot's age + size projections)
 *   5. Price + size + brand domain
 *   6. DOM helpers
 *   7. Card rendering
 *   8. Carousel
 *   9. Filter UI
 *   10. Theme + back-to-top
 *   11. Scroll restore
 *   12. Count-up
 *   13. Title intro + header glitter
 *   14. Header explosion (rubber-band + confetti + boom FX)
 *   15. Card long-press meteor zoom
 *   16. Fire burst (used after count-up)
 *   17. Celebrate-on-load confetti
 *   18. Buy warp (page recedes into screen, opens URL, restores)
 *   19. Size-note weld text + timeline dock magnification
 *   20. Init
 * ========================================================================= */


/* ============================== 1. Constants ============================ */

// Vilgot's growth anchor: on 2026-04-24 he was 7 weeks old at size 50.
// Birth = anchor − 49 days = 2026-03-05.
const VILGOT_BIRTH = new Date(Date.UTC(2026, 2, 5));

// Persists scroll position across page reloads.
const SCROLL_KEY = 'vilgot-scroll-y';

// Maps the per-product "Från X" sizing strings into clusters used by the
// size filter pills.
const SIZE_GROUPS = {
  'Prematur': ['Preemie+', 'Prematur-24M'],
  'Newborn':  ['Från NB', 'Newborn+', 'NB (3-6M)', 'Från NB'],
  '0-3M':     ['Från 0-3M', 'Från 0-3 Months', 'Från 1M', 'Från 2-4M', 'Från XS (0-3M)', 'Från 0-6M'],
  '3-6M':     ['Från 3M', 'Från 3-6M', 'Från 3-6 Months', 'Från 3-9M', 'Från 3 months'],
  '6M+':      ['Från 6M', 'Från 6MO', 'Från 6-9M', 'Från 6 Months'],
  '56-62':    ['Från 56', 'Från 62'],
  'One size': ['One size'],
};

// Currency → SEK conversion rates used by the price filter.
const CURRENCY_RATES = {
  USD: 10.5,
  GBP: 13.2,
  EUR: 11.5,
};

// Master filter state. Mutated by initFilters click handlers.
const filters = { brand: 'all', size: 'all', price: 'all' };


/* ============================ 2. Easings & timing ======================= */

const EASE_OUT_CUBIC = t => 1 - Math.pow(1 - t, 3);
const EASE_IN_CUBIC  = t => t * t * t;


/* ============================ 3. Pure utilities ========================= */

function daysBetween(a, b) {
  return Math.floor((b - a) / 86400000);
}

// Forces a synchronous reflow on `el`. Required when re-triggering a CSS
// animation by removing and re-adding a class in the same tick.
function forceReflow(el) {
  void el.offsetWidth;
}


/* ============================ 4. Size-note domain ======================= */

// Returns the EU baby size for a given age in weeks. Anchored so 7 weeks
// maps to 50 (matches Vilgot's actual sizing). Babies grow ~3–4 cm/month
// in the first half-year, slower after that.
function estimateSize(weeksOld) {
  if (weeksOld < 11)  return 50;   // 0–~2.5 months
  if (weeksOld < 15)  return 56;   // ~2.5–3.5
  if (weeksOld < 22)  return 62;   // ~3.5–5
  if (weeksOld < 30)  return 68;   // ~5–7
  if (weeksOld < 40)  return 74;   // ~7–9
  if (weeksOld < 52)  return 80;   // ~9–12
  if (weeksOld < 78)  return 86;   // ~12–18
  if (weeksOld < 104) return 92;   // ~18–24
  return 98;
}

// Human-readable Swedish age. Uses weeks under 3 months, months under 1
// year, otherwise "X år [och Y månader]".
function formatAge(days) {
  if (days < 90) return Math.floor(days / 7) + ' veckor';
  const months = Math.floor(days / 30.4375);
  if (months < 12) return months + ' månader';
  const years = Math.floor(months / 12);
  const rem = months - years * 12;
  if (rem === 0) return years === 1 ? '1 år' : years + ' år';
  return years + ' år och ' + rem + ' ' + (rem === 1 ? 'månad' : 'månader');
}

// Human-readable Swedish "om X" label for timeline milestones.
function monthLabel(n) {
  if (n < 12)         return n === 1 ? '1 månad' : n + ' månader';
  if (n === 12)       return '1 år';
  if (n % 12 === 0)   return (n / 12) + ' år';
  return Math.floor(n / 12) + ' år och ' + (n % 12) + ' mån';
}


/* ====================== 5. Price + size + brand domain ================== */

// Maps a product's `size` string ("Från 62", "One size", …) to its filter
// cluster. Falls back to keyword matching for variants we haven't enumerated.
function getSizeGroup(sizeStr) {
  if (!sizeStr) return null;
  for (const [group, variants] of Object.entries(SIZE_GROUPS)) {
    if (variants.includes(sizeStr)) return group;
  }
  const s = sizeStr.toLowerCase();
  if (s.includes('preemie') || s.includes('prematur'))                 return 'Prematur';
  if (s.includes('nb') || s.includes('newborn'))                       return 'Newborn';
  if (s.includes('0-3') || s.includes('0-6') || s.includes('1m')
      || s.includes('2-4'))                                            return '0-3M';
  if (s.includes('3-6') || s.includes('3m') || s.includes('3-9')
      || s.includes('3 month'))                                        return '3-6M';
  if (s.includes('6m') || s.includes('6-9') || s.includes('6 month'))  return '6M+';
  if (s.includes('56') || s.includes('62'))                            return '56-62';
  if (s.includes('one size'))                                          return 'One size';
  return null;
}

// Parses a product price string into SEK. Returns null if unparseable.
function parsePrice(priceStr) {
  if (!priceStr || priceStr === 'Varierar') return null;
  const cleaned = priceStr.replace(/[~\s]/g, '').replace(',', '.');
  const num = parseFloat(cleaned.replace(/[^\d.]/g, ''));
  if (isNaN(num)) return null;

  if (priceStr.includes('USD') || priceStr.includes('$')) return num * CURRENCY_RATES.USD;
  if (priceStr.includes('GBP') || priceStr.includes('£')) return num * CURRENCY_RATES.GBP;
  if (priceStr.includes('EUR') || priceStr.includes('€')) return num * CURRENCY_RATES.EUR;
  return num; // assume SEK
}

function matchPrice(priceStr, range) {
  if (range === 'all') return true;
  const sek = parsePrice(priceStr);
  if (sek === null)    return range === 'unknown';
  if (range === 'low') return sek < 300;
  if (range === 'mid') return sek >= 300 && sek <= 700;
  if (range === 'high') return sek > 700;
  return true;
}

// Brands with ≥ 3 products, sorted by count desc. Computed once and
// referenced by both the brand filter and the "Övriga" rollup.
let topBrands = [];

function computeTopBrands() {
  const counts = {};
  PRODUCTS.forEach(p => {
    if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1;
  });
  topBrands = Object.entries(counts)
    .filter(([_, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function isTopBrand(brand) {
  return topBrands.some(b => b.name === brand);
}


/* =============================== 6. DOM helpers ========================= */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


/* ============================ 7. Card rendering ========================= */

function renderCard(p, idx) {
  const isSingle      = !p.images || p.images.length <= 1;
  const hasPlaceholder = p.placeholder_text && (!p.images || p.images.length === 0);

  let html = '<div class="card" data-idx="' + idx + '">';

  // Image carousel
  html += '<div class="card-carousel' + (isSingle && !hasPlaceholder ? ' single' : '') + '">';
  html += '<div class="slides">';
  if (hasPlaceholder) {
    html += '<div class="card-img" style="' + (p.placeholder_style || '') + '">';
    html += escapeHtml(p.placeholder_text || '');
    html += '</div>';
  } else if (p.images && p.images.length > 0) {
    p.images.forEach(img => {
      html += '<img class="card-img" src="' + escapeHtml(img)
        + '" alt="' + escapeHtml(p.name) + '" loading="lazy">';
    });
  }
  html += '</div>';
  html += '<button class="arrow arrow-left">&#8249;</button>';
  html += '<button class="arrow arrow-right">&#8250;</button>';
  html += '<div class="card-dots"></div>';
  html += '</div>';

  // Body
  html += '<div class="card-body">';
  if (p.tag) {
    html += '<span class="card-tag ' + escapeHtml(p.tag_class || 'tag-rec') + '">'
      + escapeHtml(p.tag) + '</span>';
  }
  if (p.brand)       html += '<div class="brand">' + escapeHtml(p.brand) + '</div>';
  html += '<h3>' + escapeHtml(p.name) + '</h3>';
  if (p.description) html += '<p class="desc">' + escapeHtml(p.description) + '</p>';

  html += '<div class="card-meta">';
  let priceHtml = escapeHtml(p.price || '');
  if (p.original_price) {
    priceHtml += ' <span class="original">' + escapeHtml(p.original_price) + '</span>';
  }
  html += '<span class="card-price">' + priceHtml + '</span>';
  if (p.size) html += '<span class="card-size">' + escapeHtml(p.size) + '</span>';
  html += '</div>';

  if (p.url) {
    html += '<a class="buy-btn" href="' + escapeHtml(p.url) + '" target="_blank">Köp →</a>';
  }
  html += '</div></div>';
  return html;
}

// Renders the product grid in newest-first order, then wires up the
// downstream things that depend on the cards being in the DOM.
function renderProducts() {
  const grid = document.getElementById('grid');
  const sorted = PRODUCTS
    .map((p, i) => ({ product: p, idx: i }))
    .reverse();

  grid.innerHTML = sorted.map(item => renderCard(item.product, item.idx)).join('');

  // Header + footer count, animated up from 0 with a 1s pre-delay so the
  // title intro can land first. Header number triggers a fire burst on
  // completion.
  const numberEl = document.getElementById('productCountNumber');
  countUp(numberEl, PRODUCTS.length, n => n + '+', {
    delayMs:    2800,
    durationMs: 2300,
    easing:     EASE_IN_CUBIC,
    onComplete: () => fireBurstAt(numberEl),
  });
  countUp(document.getElementById('footerCount'), PRODUCTS.length, n => n + '+', {
    delayMs:    2800,
    durationMs: 2300,
    easing:     EASE_IN_CUBIC,
  });

  initCarousels();
  initFilters();
  applyFilters();
}


/* ================================ 8. Carousel =========================== */

function initCarousels() {
  document.querySelectorAll('.card-carousel').forEach(carousel => {
    const slides = carousel.querySelector('.slides');
    const images = slides.querySelectorAll('img');
    const arrowL = carousel.querySelector('.arrow-left');
    const arrowR = carousel.querySelector('.arrow-right');
    const dotsEl = carousel.querySelector('.card-dots');
    if (!images.length || images.length <= 1) return;

    carousel.classList.remove('single');
    let current = 0;

    images.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', e => { e.stopPropagation(); goTo(i); });
      dotsEl.appendChild(dot);
    });

    function goTo(idx) {
      current = Math.max(0, Math.min(idx, images.length - 1));
      slides.style.transform = 'translateX(-' + (current * 100) + '%)';
      dotsEl.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i === current);
      });
    }

    arrowL.addEventListener('click', e => { e.stopPropagation(); goTo(current - 1); });
    arrowR.addEventListener('click', e => { e.stopPropagation(); goTo(current + 1); });

    // Touch swipe
    let startX = 0, diffX = 0;
    carousel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchmove',  e => { diffX = e.touches[0].clientX - startX; }, { passive: true });
    carousel.addEventListener('touchend', () => {
      if (Math.abs(diffX) > 40) goTo(current + (diffX < 0 ? 1 : -1));
      diffX = 0;
    });
  });
}


/* ================================= 9. Filter UI ========================= */

function initFilters() {
  computeTopBrands();

  // Brand pills
  const brandGroup = document.getElementById('brandFilters');
  let brandHtml = '<label>Brand:</label>'
    + '<span class="pill active" data-filter="brand" data-value="all">Alla</span>';
  topBrands.forEach(b => {
    brandHtml += '<span class="pill" data-filter="brand" data-value="'
      + escapeAttr(b.name) + '">' + escapeHtml(b.name) + ' (' + b.count + ')</span>';
  });
  const otherCount = PRODUCTS.filter(p => !isTopBrand(p.brand)).length;
  if (otherCount > 0) {
    brandHtml += '<span class="pill" data-filter="brand" data-value="__other__">'
      + 'Övriga (' + otherCount + ')</span>';
  }
  brandGroup.innerHTML = brandHtml;

  // Size pills (only groups with ≥ 1 product)
  const sizeGroup = document.getElementById('sizeFilters');
  let sizeHtml = '<label>Storlek:</label>'
    + '<span class="pill active" data-filter="size" data-value="all">Alla</span>';
  Object.keys(SIZE_GROUPS).forEach(group => {
    const count = PRODUCTS.filter(p => getSizeGroup(p.size) === group).length;
    if (count > 0) {
      sizeHtml += '<span class="pill" data-filter="size" data-value="'
        + escapeAttr(group) + '">' + escapeHtml(group) + ' (' + count + ')</span>';
    }
  });
  sizeGroup.innerHTML = sizeHtml;

  // Price pills
  const priceGroup = document.getElementById('priceFilters');
  priceGroup.innerHTML =
    '<label>Pris:</label>'
    + '<span class="pill active" data-filter="price" data-value="all">Alla</span>'
    + '<span class="pill" data-filter="price" data-value="low">&lt;300 kr</span>'
    + '<span class="pill" data-filter="price" data-value="mid">300–700 kr</span>'
    + '<span class="pill" data-filter="price" data-value="high">&gt;700 kr</span>';

  // Click → update state, swap active state, re-apply
  document.querySelectorAll('.filter-bar .pill').forEach(pill => {
    pill.addEventListener('click', function () {
      filters[this.dataset.filter] = this.dataset.value;
      this.closest('.filter-group').querySelectorAll('.pill')
        .forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      applyFilters();
    });
  });
}

// Toggles every card's `.hidden` based on the current filter state, plays
// a settle animation on the survivors (only after the very first render).
function applyFilters() {
  const cards = document.querySelectorAll('#grid .card');
  let visible = 0;
  let firstRender = true;

  cards.forEach(card => {
    const idx = parseInt(card.dataset.idx, 10);
    const p = PRODUCTS[idx];
    const show =
      (filters.brand === 'all'
        || p.brand === filters.brand
        || (filters.brand === '__other__' && !isTopBrand(p.brand))) &&
      (filters.size === 'all' || getSizeGroup(p.size) === filters.size) &&
      matchPrice(p.price, filters.price);

    if (card.dataset.filtered) firstRender = false;
    card.dataset.filtered = '1';
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('filterCount').textContent = visible + ' av ' + PRODUCTS.length;

  if (!firstRender) animateCardSettle();
}

function animateCardSettle() {
  const visibleCards = document.querySelectorAll('#grid .card:not(.hidden)');
  visibleCards.forEach((card, i) => {
    card.classList.remove('filter-settling');
    card.style.animationDelay = Math.min(i * 12, 450) + 'ms';
    forceReflow(card);
    card.classList.add('filter-settling');
  });
  setTimeout(() => {
    visibleCards.forEach(c => {
      c.classList.remove('filter-settling');
      c.style.animationDelay = '';
    });
  }, 900);
}

// Toggles the floating filter panel; on collapse, shakes the page so the
// "slam" is felt.
function toggleFilters() {
  const bar = document.querySelector('.filter-bar');
  if (!bar) return;
  const wasOpen = !bar.classList.contains('closed');
  bar.classList.toggle('closed');
  if (wasOpen) {
    const shaker = document.getElementById('content') || document.body;
    shaker.classList.remove('filter-slam');
    forceReflow(shaker);
    shaker.classList.add('filter-slam');
    setTimeout(() => shaker.classList.remove('filter-slam'), 600);
  }
}


/* =========================== 10. Theme + back-to-top ==================== */

function initTheme() {
  const toggle = document.getElementById('themeToggle');
  document.body.setAttribute('data-theme', localStorage.getItem('vg_theme') || 'dark');
  toggle.addEventListener('click', () => {
    const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('vg_theme', next);
  });
}

function initBackToTop() {
  window.addEventListener('scroll', () => {
    document.getElementById('backTop').classList.toggle('visible', window.scrollY > 600);
  });
}


/* ============================ 11. Scroll restore ======================== */

// The initial HTML ships an empty #grid that app.js fills in. Chrome's
// native scroll restoration runs before that, so the doc is too short to
// scroll into. Take manual control: persist scrollY to sessionStorage and
// restore after renderProducts has populated the grid.
function initScrollRestore() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('beforeunload', () => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  });
}

function restoreScroll() {
  const y = parseInt(sessionStorage.getItem(SCROLL_KEY) || '0', 10);
  if (y <= 0) return;
  // 'instant' bypasses CSS `scroll-behavior: smooth`, which would animate
  // the jump and leave scrollY at 0 when celebrateOnLoad samples.
  window.scrollTo({ top: y, left: 0, behavior: 'instant' });
}


/* ================================= 12. Count-up ========================= */

// Animates a number from 0 → target. format(n) produces the shown string.
// Hidden tabs throttle rAF, so we write the final value immediately and
// skip the animation — avoids an empty element if the user loaded the
// page in a backgrounded tab and never switched to it.
function countUp(el, target, format, opts) {
  if (!el) return;
  const {
    durationMs = 2100,
    delayMs    = 1000,
    easing     = EASE_OUT_CUBIC,
    onComplete,
  } = opts || {};

  if (document.hidden) {
    el.textContent = format(target);
    if (onComplete) onComplete();
    return;
  }

  el.textContent = format(0);
  setTimeout(() => {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / durationMs);
      el.textContent = format(Math.round(easing(t) * target));
      if (t < 1) requestAnimationFrame(frame);
      else if (onComplete) onComplete();
    }
    requestAnimationFrame(frame);
  }, delayMs);
}


/* ====================== 13. Title intro + header glitter ================ */

// Splits an element's text into per-character `.char` spans with staggered
// CSS animation-delays. Returns the number of characters created.
function splitChars(el, baseDelay, stepMs) {
  const chars = [...el.textContent];
  el.textContent = '';
  chars.forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch === ' ' ? ' ' : ch;
    span.style.animationDelay = (baseDelay + i * stepMs) + 'ms';
    el.appendChild(span);
  });
  return chars.length;
}

function playTitleIntro() {
  const h1  = document.querySelector('header h1');
  const sub = document.querySelector('header .subtitle');
  if (!h1 || !sub) return;

  const titleCount = splitChars(h1, 100, 70);
  const subDelay   = 100 + titleCount * 70 + 150;
  splitChars(sub, subDelay, 35);

  // Flash when the last title char lands
  const lastCharEnd = 100 + (titleCount - 1) * 70 + 900;
  setTimeout(() => h1.classList.add('flash'), lastCharEnd);
}

// Continuously spawns tiny ✦-sparkles across the h1 area. Pauses while
// the explosion debounce is active and while the tab is hidden.
function initHeaderGlitter() {
  const h1     = document.querySelector('header h1');
  const header = document.querySelector('header');
  if (!h1 || !header) return;
  setInterval(() => {
    if (header.dataset.exploding === 'true') return;
    if (document.hidden) return;
    spawnGlitter(h1);
  }, 180);
}

function spawnGlitter(h1) {
  const r = h1.getBoundingClientRect();
  if (r.width === 0) return;
  const sparkle = document.createElement('div');
  sparkle.className = 'glitter-sparkle';
  sparkle.style.left = (r.left + Math.random() * r.width) + 'px';
  sparkle.style.top  = (r.top  + Math.random() * r.height) + 'px';
  sparkle.style.setProperty('--glitter-size', (4 + Math.random() * 8) + 'px');
  sparkle.style.animationDuration = (0.7 + Math.random() * 0.5) + 's';
  document.body.appendChild(sparkle);
  setTimeout(() => sparkle.remove(), 1300);
}


/* =========================== 14. Header explosion ======================= */

// Click the header: every char rubber-bands out to a random viewport point
// then snaps back, triggering a multi-burst confetti explosion + boom FX.
// Debounced via header.dataset.exploding while an animation is in flight.
function initHeaderExplosion() {
  const header = document.querySelector('header');
  const h1     = document.querySelector('header h1');
  if (!header || !h1) return;

  header.style.cursor = 'pointer';
  header.addEventListener('click', () => {
    if (header.dataset.exploding === 'true') return;
    header.dataset.exploding = 'true';

    const chars = [
      ...document.querySelectorAll('header h1 .char'),
      ...document.querySelectorAll('header .subtitle .char'),
    ];
    if (!chars.length) {
      delete header.dataset.exploding;
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const flyDuration = 2600;
    let latestEnd = 0;

    // Charge-up flash on the header
    header.classList.add('boom-charging');
    setTimeout(() => header.classList.remove('boom-charging'), 520);

    // Per-char rubber-band trajectory
    chars.forEach((ch, i) => {
      const rect      = ch.getBoundingClientRect();
      const originCX  = rect.left + rect.width / 2;
      const originCY  = rect.top  + rect.height / 2;
      const destCX    = Math.random() * vw;
      const destCY    = Math.random() * vh;
      const dx        = destCX - originCX;
      const dy        = destCY - originCY;
      const rot       = (Math.random() - 0.5) * 1440;   // up to ±720°
      const scaleOut  = 1.5 + Math.random() * 2;
      const delay     = i * 25;
      latestEnd = Math.max(latestEnd, delay + flyDuration);

      ch.style.position = 'relative';
      ch.style.zIndex   = '9999';

      const anim = ch.animate(
        [
          { transform: 'translate(0,0) rotate(0deg) scale(1)', offset: 0,
            easing: 'cubic-bezier(0.55, 0, 0.9, 0.2)' },
          // 10%: anticipation pull-in
          { transform: `translate(${-dx * 0.09}px, ${-dy * 0.09}px) rotate(${-rot * 0.05}deg) scale(0.65)`,
            offset: 0.1, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
          // 58%: stretched out to max, decelerating linearly (rubber band)
          { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${scaleOut})`,
            offset: 0.58, easing: 'linear' },
          // 64%: extra micro-stretch past target
          { transform: `translate(${dx * 1.06}px, ${dy * 1.06}px) rotate(${rot * 1.03}deg) scale(${scaleOut * 0.95})`,
            offset: 0.64, easing: 'cubic-bezier(0.7, 0, 0.55, 0.15)' },
          // 88%: SNAP back, oversized impact
          { transform: 'translate(0,0) rotate(0deg) scale(1.55)', offset: 0.88,
            easing: 'cubic-bezier(0.3, 1.3, 0.4, 1)' },
          // 94%: undershoot
          { transform: 'translate(0,0) rotate(0deg) scale(0.92)', offset: 0.94,
            easing: 'ease-out' },
          { transform: 'translate(0,0) rotate(0deg) scale(1)',     offset: 1 },
        ],
        { duration: flyDuration, delay, fill: 'both' },
      );
      anim.onfinish = () => {
        ch.style.zIndex    = '';
        ch.style.position  = '';
        ch.style.transform = '';
      };
    });

    // Multi-layer explosion timed to the slam-back
    const hRect    = h1.getBoundingClientRect();
    const cx       = (hRect.left + hRect.width  / 2) / vw;
    const cy       = (hRect.top  + hRect.height / 2) / vh;
    const returnAt = flyDuration * 0.88;
    fireExplosion(cx, cy, returnAt);

    setTimeout(() => { delete header.dataset.exploding; }, latestEnd + 200);
  });
}

// Boom FX + 8 confetti layers timed relative to the slam-back.
function fireExplosion(cx, cy, returnAt) {
  setTimeout(() => triggerBoomFX(cx, cy), returnAt);

  if (typeof confetti === 'undefined') return;

  const palette = ['#c9a96e', '#e4d5b7', '#fff', '#ff6b6b', '#ffcf40', '#ff3860'];
  const sparks  = ['#ffcf40', '#ff6b6b', '#fff'];

  // Layer 1: massive 360° blast
  setTimeout(() => confetti({
    particleCount: 900, spread: 360, startVelocity: 110,
    origin: { x: cx, y: cy }, colors: palette,
    gravity: 0.7, scalar: 1.6, ticks: 320,
  }), returnAt);

  // Layer 2: hyper-fast inner ring
  setTimeout(() => confetti({
    particleCount: 500, spread: 360, startVelocity: 170,
    origin: { x: cx, y: cy }, colors: palette,
    gravity: 0.55, scalar: 1.1, ticks: 380,
  }), returnAt + 30);

  // Side cannons, triple-stacked with escalating velocity
  [0, 90, 180].forEach((t, i) => {
    const v = 85 + i * 15;
    const y = 0.5 + i * 0.15;
    setTimeout(() => confetti({
      particleCount: 320, spread: 100, angle: 60,
      startVelocity: v, origin: { x: -0.05, y }, colors: palette,
      scalar: 1.3, ticks: 320,
    }), returnAt + t);
    setTimeout(() => confetti({
      particleCount: 320, spread: 100, angle: 120,
      startVelocity: v, origin: { x: 1.05, y }, colors: palette,
      scalar: 1.3, ticks: 320,
    }), returnAt + t);
  });

  // Bottom-corner uppercuts
  setTimeout(() => confetti({
    particleCount: 240, spread: 60, angle: 55, startVelocity: 115,
    origin: { x: 0.08, y: 1.1 }, colors: palette,
    scalar: 1.4, ticks: 360,
  }), returnAt + 160);
  setTimeout(() => confetti({
    particleCount: 240, spread: 60, angle: 125, startVelocity: 115,
    origin: { x: 0.92, y: 1.1 }, colors: palette,
    scalar: 1.4, ticks: 360,
  }), returnAt + 160);

  // Golden top-edge downpour
  [0.2, 0.5, 0.8].forEach((x, i) => {
    setTimeout(() => confetti({
      particleCount: 300, spread: 160, startVelocity: 40,
      origin: { x, y: -0.1 }, colors: palette,
      gravity: 1.7, scalar: 1.2, ticks: 450,
    }), returnAt + 220 + i * 60);
  });

  // Fire-sparks: tiny fast warm particles
  setTimeout(() => confetti({
    particleCount: 400, spread: 360, startVelocity: 200,
    origin: { x: cx, y: cy }, colors: sparks,
    gravity: 0.4, scalar: 0.6, ticks: 260,
  }), returnAt + 60);

  // Aftershock
  setTimeout(() => confetti({
    particleCount: 400, spread: 360, startVelocity: 70,
    origin: { x: cx, y: cy }, colors: palette,
    gravity: 0.95, scalar: 1.0, ticks: 300,
  }), returnAt + 650);
}

// Multi-layer screen FX: white flash, three shock waves, anime speed lines,
// zoom-punch on <html> + aggressive shake on <body>.
function triggerBoomFX(cx, cy) {
  const px = cx * window.innerWidth;
  const py = cy * window.innerHeight;

  // Flash
  const flash = document.createElement('div');
  flash.className = 'boom-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 800);

  // Three shock waves
  [
    { cls: 'boom-wave',                  remove: 1100 },
    { cls: 'boom-wave boom-wave-slow',   remove: 1500 },
    { cls: 'boom-wave boom-wave-red',    remove: 1300 },
  ].forEach(({ cls, remove }) => {
    const w = document.createElement('div');
    w.className = cls;
    w.style.left = px + 'px';
    w.style.top  = py + 'px';
    document.body.appendChild(w);
    setTimeout(() => w.remove(), remove);
  });

  // Anime speed lines
  const lines = document.createElement('div');
  lines.className = 'boom-lines';
  lines.style.left = px + 'px';
  lines.style.top  = py + 'px';
  document.body.appendChild(lines);
  setTimeout(() => lines.remove(), 900);

  // Zoom on html, shake on body — different elements so transforms compose
  document.documentElement.classList.add('boom-zoom');
  document.body.classList.add('boom-shake');
  setTimeout(() => {
    document.documentElement.classList.remove('boom-zoom');
    document.body.classList.remove('boom-shake');
  }, 900);
}


/* ===================== 15. Card long-press meteor zoom ================== */

// Holding a card image zooms a clone up to ~94% of the viewport. Releasing
// slams it back into the card with a meteor squash-and-stretch impact, a
// crater shockwave on neighbouring cards, two impact rings, and a screen
// shake. Touch + mouse supported.
function initCardLongPress() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  let state = null;

  grid.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('.arrow, .dot, .buy-btn')) return;
    const img = e.target.closest('.card-carousel img.card-img');
    if (!img) return;
    e.preventDefault();
    state = startCardZoom(img);
  });

  function finish() {
    if (!state) return;
    endCardZoom(state);
    state = null;
  }
  window.addEventListener('pointerup',     finish);
  window.addEventListener('pointercancel', finish);
  window.addEventListener('blur',          finish);
}

function startCardZoom(img) {
  const rect = img.getBoundingClientRect();
  const clone = img.cloneNode(false);
  clone.removeAttribute('loading');
  clone.className = 'card-zoom-clone';
  Object.assign(clone.style, {
    position:        'fixed',
    left:            rect.left + 'px',
    top:             rect.top  + 'px',
    width:           rect.width  + 'px',
    height:          rect.height + 'px',
    margin:          '0',
    zIndex:          '99999',
    objectFit:       'cover',
    transformOrigin: 'center center',
    willChange:      'transform',
    pointerEvents:   'none',
    borderRadius:    '12px',
    boxShadow:       '0 30px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(201,169,110,0.3)',
  });
  document.body.appendChild(clone);

  const backdrop = document.createElement('div');
  backdrop.className = 'card-zoom-backdrop';
  document.body.appendChild(backdrop);
  backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, fill: 'forwards' });

  const vw       = window.innerWidth;
  const vh       = window.innerHeight;
  const maxScale = Math.min((vw * 0.94) / rect.width, (vh * 0.94) / rect.height);
  const dx       = vw / 2 - (rect.left + rect.width  / 2);
  const dy       = vh / 2 - (rect.top  + rect.height / 2);

  const growAnim = clone.animate(
    [
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${dx}px, ${dy}px) scale(${maxScale})` },
    ],
    { duration: 900, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
  );

  return { clone, backdrop, growAnim, img };
}

function endCardZoom(state) {
  const { clone, backdrop, growAnim, img } = state;

  // Freeze grow at its current transform, then play meteor return
  const curTransform = getComputedStyle(clone).transform;
  growAnim.cancel();
  clone.style.transform = curTransform;

  const returnAnim = clone.animate(
    [
      { transform: curTransform,                                        offset: 0 },
      // 70%: near target, accelerating
      { transform: 'translate(0,0) scale(1.25) rotate(3deg)',           offset: 0.7,
        easing: 'cubic-bezier(0.8, 0, 0.9, 0.4)' },
      // 78%: IMPACT — vertical squash
      { transform: 'translate(0, 4px) scale(1.22, 0.72) rotate(-1deg)', offset: 0.78 },
      // 90%: rebound stretch
      { transform: 'translate(0,0) scale(0.92, 1.12) rotate(1deg)',     offset: 0.9 },
      // 96%: micro
      { transform: 'translate(0,0) scale(1.03) rotate(0)',              offset: 0.96 },
      { transform: 'translate(0,0) scale(1) rotate(0)',                 offset: 1 },
    ],
    { duration: 440, easing: 'linear', fill: 'forwards' },
  );
  backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' });

  // Fire impact FX a hair before the squash finishes so the crunch on the
  // card and the crater ripple land together.
  const IMPACT_AT = 340; // ms into the 440 ms return
  const card     = img.closest('.card');
  const cardRect = (card || img).getBoundingClientRect();
  const impactCX = cardRect.left + cardRect.width  / 2;
  const impactCY = cardRect.top  + cardRect.height / 2;

  setTimeout(() => {
    if (card) {
      card.classList.remove('card-impact');
      forceReflow(card);
      card.classList.add('card-impact');
      setTimeout(() => card.classList.remove('card-impact'), 700);
    }
    spawnImpactRings(impactCX, impactCY);
    triggerCraterShockwave(impactCX, impactCY, card);
    document.body.classList.remove('meteor-shake');
    forceReflow(document.body);
    document.body.classList.add('meteor-shake');
    setTimeout(() => document.body.classList.remove('meteor-shake'), 650);
  }, IMPACT_AT);

  returnAnim.onfinish = () => {
    clone.remove();
    backdrop.remove();
  };
}

// Two concentric shock rings at the impact point.
function spawnImpactRings(cx, cy) {
  [
    { cls: 'meteor-ring',                 life: 850 },
    { cls: 'meteor-ring meteor-ring-gold', life: 700 },
  ].forEach(({ cls, life }) => {
    const ring = document.createElement('div');
    ring.className = cls;
    ring.style.left = cx + 'px';
    ring.style.top  = cy + 'px';
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), life);
  });
}

// Push neighbouring cards outward with strength ∝ (1 − dist/maxDist).
// Closer cards react sooner; they spring back via elastic ease.
function triggerCraterShockwave(cx, cy, hitCard) {
  const MAX_DISTANCE = 550;
  const MAX_PUSH     = 46;
  document.querySelectorAll('#grid .card:not(.hidden)').forEach(c => {
    if (c === hitCard) return;
    const r    = c.getBoundingClientRect();
    const dx   = r.left + r.width  / 2 - cx;
    const dy   = r.top  + r.height / 2 - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    if (dist > MAX_DISTANCE) return;

    const strength = 1 - dist / MAX_DISTANCE;
    const pushX    = (dx / dist) * MAX_PUSH * strength;
    const pushY    = (dy / dist) * MAX_PUSH * strength;
    const delay    = Math.min(dist * 0.4, 150);

    c.style.setProperty('--crater-dx', pushX + 'px');
    c.style.setProperty('--crater-dy', pushY + 'px');
    c.style.animation = 'craterPush 0.7s cubic-bezier(0.3, 1.4, 0.4, 1) ' + delay + 'ms both';

    setTimeout(() => {
      c.style.animation = '';
      c.style.removeProperty('--crater-dx');
      c.style.removeProperty('--crater-dy');
    }, 900 + delay);
  });
}


/* =============================== 16. Fire burst ========================= */

// Pure DOM fire effect focused on an element: punch-zoom + glow on the
// element itself, a throbbing core fire blob, three expanding rings, and
// a dense ember swarm rising from around the target.
function fireBurstAt(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;

  el.classList.add('on-fire');
  setTimeout(() => el.classList.remove('on-fire'), 1500);

  // Core fire blob
  const core = document.createElement('div');
  core.className = 'fire-core';
  core.style.left = cx + 'px';
  core.style.top  = cy + 'px';
  document.body.appendChild(core);
  setTimeout(() => core.remove(), 1200);

  // Three rings (gold, red, white-hot inner)
  [
    { cls: 'fire-ring',                   life: 1100 },
    { cls: 'fire-ring fire-ring-red',     life: 1300 },
    { cls: 'fire-ring fire-ring-inner',   life: 700  },
  ].forEach(({ cls, life }) => {
    const ring = document.createElement('div');
    ring.className = cls;
    ring.style.left = cx + 'px';
    ring.style.top  = cy + 'px';
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), life);
  });

  // Ember swarm
  const EMBER_COUNT = 140;
  const COLORS = ['#ff3e00', '#ff6b00', '#ff9a00', '#ffcf40', '#ffed4e', '#fff'];
  for (let i = 0; i < EMBER_COUNT; i++) {
    const ember = document.createElement('div');
    ember.className = 'ember';

    const startX = cx + (Math.random() - 0.5) * rect.width  * 0.7;
    const startY = cy + (Math.random() - 0.5) * rect.height * 0.5;
    const rise   = 180 + Math.random() * 420;
    const drift  = (Math.random() - 0.5) * 320;
    const size   = 3 + Math.random() * 8;
    const life   = 900 + Math.random() * 800;
    const delay  = Math.random() * 280;

    Object.assign(ember.style, {
      left:       startX + 'px',
      top:        startY + 'px',
      width:      size + 'px',
      height:     size + 'px',
      background: COLORS[Math.floor(Math.random() * COLORS.length)],
      animation:  'emberRise ' + life + 'ms ease-out ' + delay + 'ms forwards',
    });
    ember.style.setProperty('--drift', drift + 'px');
    ember.style.setProperty('--rise',  -rise + 'px');
    document.body.appendChild(ember);
    setTimeout(() => ember.remove(), life + delay + 50);
  }
}


/* ====================== 17. Celebrate-on-load confetti ================== */

// Fires a staggered confetti burst over every card currently in the
// viewport. Runs once on page load.
function celebrateOnLoad() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const visible = Array.from(document.querySelectorAll('#grid .card:not(.hidden)'))
    .filter(card => {
      const r = card.getBoundingClientRect();
      return r.top < vh && r.bottom > 0;
    });

  visible.forEach((card, i) => {
    setTimeout(() => {
      const r = card.getBoundingClientRect();
      confetti({
        particleCount: 60, spread: 50,
        origin: {
          x: (r.left + r.width  / 2) / vw,
          y: (r.top  + r.height / 2) / vh,
        },
        colors: ['#c9a96e', '#ff6b6b', '#fff'],
        gravity: 1.2, scalar: 0.8,
      });
    }, i * 120);
  });
}


/* ================================ 18. Buy warp ========================== */

// Click a "Köp" button: the page recedes into the viewport-center pixel
// over ~750 ms, then opens the URL. When the user comes back to this tab
// (or 4 s elapse without ever losing visibility), the page warps back.
function initBuyWarp() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.buy-btn');
    if (!btn || !btn.href) return;
    e.preventDefault();
    warpTo(btn.href, btn.target || '_self');
  });
}

function warpTo(url, target) {
  const ox = window.scrollX + window.innerWidth  / 2;
  const oy = window.scrollY + window.innerHeight / 2;
  document.body.style.transformOrigin             = `${ox}px ${oy}px`;
  document.documentElement.style.perspectiveOrigin = `${ox}px ${oy}px`;

  // Clip body to viewport rect so off-screen content stays invisible while
  // the page shrinks.
  const top    = window.scrollY;
  const bottom = Math.max(0,
    document.body.scrollHeight - window.scrollY - window.innerHeight);
  document.body.style.clipPath = `inset(${top}px 0 ${bottom}px 0)`;

  document.documentElement.classList.add('warping');

  // Open the URL after the warp-out fully finishes + a tiny hold so the
  // page is clearly gone before the new tab opens.
  const OPEN_AT = 750;
  setTimeout(() => {
    if (target === '_self' || target === '') window.location.href = url;
    else if (url) window.open(url, target);
  }, OPEN_AT);

  // Wait until the user returns to this tab (visibilitychange / focus)
  // before restoring. Listeners must be attached BEFORE window.open so
  // the parent's visibility transition to hidden is captured.
  let restored   = false;
  let wentHidden = false;

  function doRestore() {
    if (restored) return;
    restored = true;
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', onFocus);

    document.documentElement.classList.remove('warping');
    forceReflow(document.documentElement);
    document.documentElement.classList.add('warping-restore');
    setTimeout(() => {
      document.documentElement.classList.remove('warping-restore');
      document.body.style.transformOrigin              = '';
      document.body.style.clipPath                     = '';
      document.documentElement.style.perspectiveOrigin = '';
    }, 280);
  }
  function onVis() {
    if (document.visibilityState === 'hidden') wentHidden = true;
    else if (wentHidden && document.visibilityState === 'visible') doRestore();
  }
  function onFocus() { if (wentHidden) doRestore(); }

  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus', onFocus);

  // Fallback: if we never even went hidden (popup blocked, same-tab nav
  // didn't take effect), restore after 4 s so the page can't sit warped
  // forever.
  setTimeout(() => { if (!wentHidden) doRestore(); }, OPEN_AT + 4000);
}


/* ================== 19. Size-note weld + timeline dock ================== */

function renderSizeNote() {
  const intro = document.getElementById('sizeNoteIntro');
  const list  = document.getElementById('sizeProjection');
  if (!intro || !list) return;

  const now   = new Date();
  const days  = Math.max(0, daysBetween(VILGOT_BIRTH, now));
  const weeks = Math.floor(days / 7);
  const size  = estimateSize(weeks);

  intro.textContent =
    'Vilgot är nu ' + formatAge(days) + ' gammal och bär storlek ' + size + '. ' +
    'Bäbisar växer snabbast under första halvåret — ungefär 3–4 cm per månad — ' +
    'och byter oftast storlek var 6–8:e vecka fram till ca 6 månader. ' +
    'Därefter saktar tillväxten ner och varje storlek räcker i flera månader.';

  const milestones = [1, 2, 3, 4, 6, 9, 12, 18];
  list.className = 'size-timeline';
  list.innerHTML = milestones.map((m, i) => {
    const future  = new Date(now.getTime() + m * 30.4375 * 86400000);
    const fWeeks  = Math.floor(daysBetween(VILGOT_BIRTH, future) / 7);
    const fSize   = estimateSize(fWeeks);
    return '<li class="milestone" style="--i:' + i + '">'
         +   '<span class="milestone-top">Om ' + monthLabel(m) + '</span>'
         +   '<span class="milestone-dot"></span>'
         +   '<span class="milestone-bottom">stl ' + fSize + '</span>'
         + '</li>';
  }).join('');
}

// Welds text in like a sparking torch: each char flashes white-hot, fades
// to gold, then settles. Tiny spark particles fly up at random char
// positions while the line is being written.
function initSizeNoteWeld() {
  const details = document.querySelector('details.size-note');
  if (!details) return;

  // Replace each text element's content with an invisible placeholder so
  // the box reserves its full height while the panel is "empty" before
  // the weld begins.
  function stash(el) {
    if (!el) return;
    if (!el.dataset.weldText) el.dataset.weldText = el.textContent;
    const ph = document.createElement('span');
    ph.className   = 'weld-placeholder';
    ph.textContent = el.dataset.weldText;
    el.textContent = '';
    el.appendChild(ph);
  }
  function stashAll() {
    stash(document.getElementById('sizeNoteIntro'));
    details.querySelectorAll('.milestone .milestone-top, .milestone .milestone-bottom')
      .forEach(stash);
  }
  stashAll();

  details.addEventListener('toggle', () => {
    if (!details.open) return;
    stashAll();
    // Wait for the box to finish expanding before kicking off the weld.
    setTimeout(() => weldTextInside(details), 600);
  });
}

// Replaces an element's stashed text with `.weld-char` spans, each with
// a staggered animation-delay. Returns when the last char fires.
function weldText(el, baseDelay, charStep) {
  if (!el) return 0;
  if (!el.dataset.weldText) el.dataset.weldText = el.textContent;
  const text  = el.dataset.weldText;
  const chars = [...text];

  el.textContent = '';
  chars.forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'weld-char';
    span.textContent = ch === ' ' ? ' ' : ch;
    span.style.animationDelay = (baseDelay + i * charStep) + 'ms';
    el.appendChild(span);
  });
  return baseDelay + chars.length * charStep;
}

function weldTextInside(details) {
  const intro      = document.getElementById('sizeNoteIntro');
  const milestones = details.querySelectorAll('.milestone');
  const STEP = 12;

  let endTime = weldText(intro, 0, STEP);
  milestones.forEach((m, i) => {
    const top   = m.querySelector('.milestone-top');
    const bot   = m.querySelector('.milestone-bottom');
    const start = i * 18;
    const e1 = weldText(top, start, STEP);
    const e2 = weldText(bot, start + 30, STEP);
    endTime = Math.max(endTime, e1, e2);
  });

  // Spark particles at random char positions during the welding
  const sparkCount = Math.min(50, Math.round(endTime / 60));
  for (let i = 0; i < sparkCount; i++) {
    setTimeout(() => spawnWeldSpark(details), Math.random() * endTime);
  }
}

function spawnWeldSpark(scope) {
  const chars = scope.querySelectorAll('.weld-char');
  if (!chars.length) return;
  const ch    = chars[Math.floor(Math.random() * chars.length)];
  const rect  = ch.getBoundingClientRect();
  if (rect.width === 0) return;

  const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
  const dist  = 25 + Math.random() * 55;
  const spark = document.createElement('div');
  spark.className = 'weld-spark';
  spark.style.left = rect.left + rect.width  / 2 + 'px';
  spark.style.top  = rect.top  + rect.height / 2 + 'px';
  spark.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
  spark.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
  spark.style.animationDuration = (0.6 + Math.random() * 0.5) + 's';
  document.body.appendChild(spark);
  setTimeout(() => spark.remove(), 1200);
}

// macOS-Dock-style magnification: hover the timeline, milestones near the
// cursor scale up with a smooth Gaussian falloff. Only active once the
// open animation has settled so the two transforms don't fight.
function initSizeTimelineDock() {
  const timeline = document.getElementById('sizeProjection');
  const details  = document.querySelector('details.size-note');
  if (!timeline || !details) return;

  const FALLOFF   = 140;  // px around cursor where items react
  const MAX_BOOST = 0.85; // additional magnification at the cursor

  details.addEventListener('toggle', () => {
    if (details.open) setTimeout(() => timeline.classList.add('dock-active'), 750);
    else timeline.classList.remove('dock-active');
  });

  timeline.addEventListener('mousemove', e => {
    if (!timeline.classList.contains('dock-active')) return;
    timeline.querySelectorAll('.milestone').forEach(m => {
      const r    = m.getBoundingClientRect();
      const dist = Math.abs(e.clientX - (r.left + r.width / 2));
      const t    = Math.max(0, 1 - dist / FALLOFF);
      // Smoothstep falloff (3t² − 2t³) — soft, not linear
      const factor = t * t * (3 - 2 * t);
      m.style.setProperty('--dock-scale', String(1 + factor * MAX_BOOST));
    });
  });

  timeline.addEventListener('mouseleave', () => {
    timeline.querySelectorAll('.milestone').forEach(m => {
      m.style.setProperty('--dock-scale', '1');
    });
  });
}


/* =================================== 20. Init =========================== */

document.addEventListener('DOMContentLoaded', () => {
  // Capture scroll behaviour first so subsequent renders don't fight it.
  initScrollRestore();

  // Theme + size note can run in any order; do them up-front so the page
  // visually settles into its state.
  initTheme();
  renderSizeNote();
  initSizeNoteWeld();
  initSizeTimelineDock();

  // Title intro splits text into chars; do it before glitter starts so
  // glitter can spawn over the rendered title.
  playTitleIntro();
  initHeaderExplosion();
  initHeaderGlitter();

  // Grid + grid-dependent interactions.
  renderProducts();
  initCardLongPress();
  initBuyWarp();

  // Restore scroll AFTER renderProducts so the document has its full height.
  restoreScroll();
  initBackToTop();

  // Small delay so the cards have settled before we throw confetti at them.
  setTimeout(celebrateOnLoad, 300);
});
