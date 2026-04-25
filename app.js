// ===== VILGOTS GARDEROB - APP.JS =====
// Rendering, filtering, animations


// ===== SIZE NORMALIZATION =====
const SIZE_GROUPS = {
  'Prematur': ['Preemie+', 'Prematur-24M'],
  'Newborn': ['Från NB', 'Newborn+', 'NB (3-6M)', 'Från NB'],
  '0-3M': ['Från 0-3M', 'Från 0-3 Months', 'Från 1M', 'Från 2-4M', 'Från XS (0-3M)', 'Från 0-6M'],
  '3-6M': ['Från 3M', 'Från 3-6M', 'Från 3-6 Months', 'Från 3-9M', 'Från 3 months'],
  '6M+': ['Från 6M', 'Från 6MO', 'Från 6-9M', 'Från 6 Months'],
  '56-62': ['Från 56', 'Från 62'],
  'One size': ['One size'],
};

function getSizeGroup(sizeStr) {
  if (!sizeStr) return null;
  for (const [group, variants] of Object.entries(SIZE_GROUPS)) {
    if (variants.includes(sizeStr)) return group;
  }
  // Fallback: try partial matching
  const s = sizeStr.toLowerCase();
  if (s.includes('preemie') || s.includes('prematur')) return 'Prematur';
  if (s.includes('nb') || s.includes('newborn')) return 'Newborn';
  if (s.includes('0-3') || s.includes('0-6') || s.includes('1m') || s.includes('2-4')) return '0-3M';
  if (s.includes('3-6') || s.includes('3m') || s.includes('3-9') || s.includes('3 month')) return '3-6M';
  if (s.includes('6m') || s.includes('6-9') || s.includes('6 month')) return '6M+';
  if (s.includes('56') || s.includes('62')) return '56-62';
  if (s.includes('one size')) return 'One size';
  return null;
}

// ===== PRICE PARSING =====
function parsePrice(priceStr) {
  if (!priceStr || priceStr === 'Varierar') return null;
  // Extract numeric part
  const cleaned = priceStr.replace(/[~\s]/g, '').replace(',', '.');
  const num = parseFloat(cleaned.replace(/[^\d.]/g, ''));
  if (isNaN(num)) return null;

  // Currency conversion to SEK
  if (priceStr.includes('USD') || priceStr.includes('$')) return num * 10.5;
  if (priceStr.includes('GBP') || priceStr.includes('£')) return num * 13.2;
  if (priceStr.includes('EUR') || priceStr.includes('€')) return num * 11.5;
  return num; // SEK
}

function matchPrice(priceStr, range) {
  if (range === 'all') return true;
  const sek = parsePrice(priceStr);
  if (sek === null) return range === 'unknown';
  if (range === 'low') return sek < 300;
  if (range === 'mid') return sek >= 300 && sek <= 700;
  if (range === 'high') return sek > 700;
  return true;
}

// ===== FILTER STATE =====
const filters = { brand: 'all', size: 'all', price: 'all' };

function applyFilters() {
  const cards = document.querySelectorAll('#grid .card');
  let visible = 0;
  let firstRender = true;
  cards.forEach(card => {
    const idx = parseInt(card.dataset.idx, 10);
    const p = PRODUCTS[idx];
    const show =
      (filters.brand === 'all' || p.brand === filters.brand || (filters.brand === '__other__' && !isTopBrand(p.brand))) &&
      (filters.size === 'all' || getSizeGroup(p.size) === filters.size) &&
      matchPrice(p.price, filters.price);
    if (card.dataset.filtered) firstRender = false;
    card.dataset.filtered = '1';
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('filterCount').textContent = visible + ' av ' + PRODUCTS.length;

  // Skip the settle animation on the very first render (cards already have
  // their entrance via the grid fade-in). Only animate on subsequent changes.
  if (!firstRender) {
    animateCardSettle();
  }
}

function animateCardSettle() {
  const visibleCards = document.querySelectorAll('#grid .card:not(.hidden)');
  visibleCards.forEach((card, i) => {
    // Restart the animation from scratch by removing and forcing reflow
    card.classList.remove('filter-settling');
    // Stagger earlier cards first, cap so later cards don't trail forever
    const delay = Math.min(i * 12, 450);
    card.style.animationDelay = delay + 'ms';
    // Force reflow so removing+re-adding the class actually retriggers
    void card.offsetWidth;
    card.classList.add('filter-settling');
  });
  // Clean up once animations complete
  setTimeout(() => {
    visibleCards.forEach(c => {
      c.classList.remove('filter-settling');
      c.style.animationDelay = '';
    });
  }, 450 + 450);
}

// ===== BRAND ANALYSIS =====
let topBrands = [];

function getTopBrands() {
  const counts = {};
  PRODUCTS.forEach(p => {
    if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([_, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function isTopBrand(brand) {
  return topBrands.some(b => b.name === brand);
}

// ===== FILTER UI GENERATION =====
function initFilters() {
  topBrands = getTopBrands();

  const brandGroup = document.getElementById('brandFilters');
  let brandHtml = '<label>Brand:</label>';
  brandHtml += '<span class="pill active" data-filter="brand" data-value="all">Alla</span>';
  topBrands.forEach(b => {
    brandHtml += '<span class="pill" data-filter="brand" data-value="' + escapeAttr(b.name) + '">' + escapeHtml(b.name) + ' (' + b.count + ')</span>';
  });
  // Count "other" brands
  const otherCount = PRODUCTS.filter(p => !isTopBrand(p.brand)).length;
  if (otherCount > 0) {
    brandHtml += '<span class="pill" data-filter="brand" data-value="__other__">Övriga (' + otherCount + ')</span>';
  }
  brandGroup.innerHTML = brandHtml;

  const sizeGroup = document.getElementById('sizeFilters');
  let sizeHtml = '<label>Storlek:</label>';
  sizeHtml += '<span class="pill active" data-filter="size" data-value="all">Alla</span>';
  // Only show size groups that have products
  Object.keys(SIZE_GROUPS).forEach(group => {
    const count = PRODUCTS.filter(p => getSizeGroup(p.size) === group).length;
    if (count > 0) {
      sizeHtml += '<span class="pill" data-filter="size" data-value="' + escapeAttr(group) + '">' + escapeHtml(group) + ' (' + count + ')</span>';
    }
  });
  sizeGroup.innerHTML = sizeHtml;

  const priceGroup = document.getElementById('priceFilters');
  let priceHtml = '<label>Pris:</label>';
  priceHtml += '<span class="pill active" data-filter="price" data-value="all">Alla</span>';
  priceHtml += '<span class="pill" data-filter="price" data-value="low">&lt;300 kr</span>';
  priceHtml += '<span class="pill" data-filter="price" data-value="mid">300–700 kr</span>';
  priceHtml += '<span class="pill" data-filter="price" data-value="high">&gt;700 kr</span>';
  priceGroup.innerHTML = priceHtml;

  // Attach click handlers to all pills
  document.querySelectorAll('.filter-bar .pill').forEach(pill => {
    pill.addEventListener('click', function() {
      const filterType = this.dataset.filter;
      const value = this.dataset.value;
      filters[filterType] = value;
      // Update active states for this filter group
      this.closest('.filter-group').querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      applyFilters();
    });
  });
}

function toggleFilters() {
  const bar = document.querySelector('.filter-bar');
  if (!bar) return;
  const wasOpen = !bar.classList.contains('closed');
  bar.classList.toggle('closed');
  // On collapse, shake the page so the slam is felt
  if (wasOpen) {
    const shaker = document.getElementById('content') || document.body;
    shaker.classList.remove('filter-slam');
    void shaker.offsetWidth;
    shaker.classList.add('filter-slam');
    setTimeout(() => shaker.classList.remove('filter-slam'), 600);
  }
}

// ===== RENDERING =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderCard(p, idx) {
  let html = '<div class="card" data-idx="' + idx + '">';

  // Carousel / image area
  const isSingle = !p.images || p.images.length <= 1;
  const hasPlaceholder = p.placeholder_text && (!p.images || p.images.length === 0);

  html += '<div class="card-carousel' + (isSingle && !hasPlaceholder ? ' single' : '') + '">';
  html += '<div class="slides">';

  if (hasPlaceholder) {
    html += '<div class="card-img" style="' + (p.placeholder_style || '') + '">';
    html += escapeHtml(p.placeholder_text || '');
    html += '</div>';
  } else if (p.images && p.images.length > 0) {
    p.images.forEach(function(img) {
      html += '<img class="card-img" src="' + escapeHtml(img) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">';
    });
  }

  html += '</div>';
  html += '<button class="arrow arrow-left">&#8249;</button>';
  html += '<button class="arrow arrow-right">&#8250;</button>';
  html += '<div class="card-dots"></div>';
  html += '</div>';

  // Card body
  html += '<div class="card-body">';

  if (p.tag) {
    html += '<span class="card-tag ' + escapeHtml(p.tag_class || 'tag-rec') + '">' + escapeHtml(p.tag) + '</span>';
  }

  if (p.brand) {
    html += '<div class="brand">' + escapeHtml(p.brand) + '</div>';
  }

  html += '<h3>' + escapeHtml(p.name) + '</h3>';

  if (p.description) {
    html += '<p class="desc">' + escapeHtml(p.description) + '</p>';
  }

  html += '<div class="card-meta">';

  // Price
  let priceHtml = escapeHtml(p.price || '');
  if (p.original_price) {
    priceHtml += ' <span class="original">' + escapeHtml(p.original_price) + '</span>';
  }
  html += '<span class="card-price">' + priceHtml + '</span>';

  if (p.size) {
    html += '<span class="card-size">' + escapeHtml(p.size) + '</span>';
  }
  html += '</div>';

  if (p.url) {
    html += '<a class="buy-btn" href="' + escapeHtml(p.url) + '" target="_blank">Köp →</a>';
  }

  html += '</div></div>';
  return html;
}

function renderProducts() {
  const grid = document.getElementById('grid');

  // Reverse: most recently added first
  const sorted = PRODUCTS.map(function(p, i) { return { product: p, idx: i }; }).reverse();

  let html = '';
  sorted.forEach(function(item) {
    html += renderCard(item.product, item.idx);
  });

  grid.innerHTML = html;

  // Update counts
  // Wait until the title intro finishes, then count up with an accelerating
  // ease-in so it feels like a buildup. When it lands, explode on the number.
  const numberEl = document.getElementById('productCountNumber');
  countUp(numberEl, PRODUCTS.length, n => n + '+', {
    delayMs: 2800,
    durationMs: 2300,
    easing: EASE_IN_CUBIC,
    onComplete: () => fireBurstAt(numberEl),
  });
  countUp(document.getElementById('footerCount'), PRODUCTS.length, n => n + '+', {
    delayMs: 2800,
    durationMs: 2300,
    easing: EASE_IN_CUBIC,
  });

  // Initialize carousels
  initCarousels();

  // Initialize filters
  initFilters();

  // Apply initial filter state
  applyFilters();
}

// ===== CAROUSEL =====
function initCarousels() {
  document.querySelectorAll('.card-carousel').forEach(function(carousel) {
    const slides = carousel.querySelector('.slides');
    const images = slides.querySelectorAll('img');
    const arrowL = carousel.querySelector('.arrow-left');
    const arrowR = carousel.querySelector('.arrow-right');
    const dotsEl = carousel.querySelector('.card-dots');
    if (!images.length || images.length <= 1) return;

    carousel.classList.remove('single');
    let current = 0;

    images.forEach(function(_, i) {
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', function(e) { e.stopPropagation(); goTo(i); });
      dotsEl.appendChild(dot);
    });

    function goTo(idx) {
      current = Math.max(0, Math.min(idx, images.length - 1));
      slides.style.transform = 'translateX(-' + (current * 100) + '%)';
      dotsEl.querySelectorAll('.dot').forEach(function(d, i) { d.classList.toggle('active', i === current); });
    }

    arrowL.addEventListener('click', function(e) { e.stopPropagation(); goTo(current - 1); });
    arrowR.addEventListener('click', function(e) { e.stopPropagation(); goTo(current + 1); });

    let startX = 0, diffX = 0;
    carousel.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchmove', function(e) { diffX = e.touches[0].clientX - startX; }, { passive: true });
    carousel.addEventListener('touchend', function() {
      if (Math.abs(diffX) > 40) {
        if (diffX < 0) goTo(current + 1);
        else goTo(current - 1);
      }
      diffX = 0;
    });
  });
}

// ===== CONFETTI ON LOAD =====
// Fires a staggered confetti burst over every card currently in the viewport.
function celebrateOnLoad() {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const visible = Array.from(
    document.querySelectorAll('#grid .card:not(.hidden)')
  ).filter(card => {
    const rect = card.getBoundingClientRect();
    return rect.top < vh && rect.bottom > 0;
  });
  visible.forEach((card, index) => {
    setTimeout(() => {
      const r = card.getBoundingClientRect();
      confetti({
        particleCount: 60,
        spread: 50,
        origin: {
          x: (r.left + r.width / 2) / vw,
          y: (r.top + r.height / 2) / vh,
        },
        colors: ['#c9a96e', '#ff6b6b', '#fff'],
        gravity: 1.2,
        scalar: 0.8,
      });
    }, index * 120);
  });
}

// ===== THEME TOGGLE =====
function initTheme() {
  const toggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('vg_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);

  toggle.addEventListener('click', function() {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('vg_theme', next);
  });
}

// ===== BACK TO TOP =====
function initBackToTop() {
  window.addEventListener('scroll', function() {
    const btn = document.getElementById('backTop');
    btn.classList.toggle('visible', window.scrollY > 600);
  });
}

// ===== COUNT-UP =====
// Animates a number from 0 → target using requestAnimationFrame.
// ease: easeOutCubic. format(n) wraps the current integer for display.
const EASE_OUT_CUBIC = t => 1 - Math.pow(1 - t, 3);
const EASE_IN_CUBIC  = t => t * t * t;

function countUp(el, target, format, opts) {
  if (!el) return;
  const { durationMs = 2100, delayMs = 1000, onComplete, easing = EASE_OUT_CUBIC } = opts || {};
  // Hidden tabs throttle rAF, so write the final value immediately and
  // skip the animation — avoids an empty element if the user loaded in a
  // background tab and never switched to it.
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
      if (t < 1) {
        requestAnimationFrame(frame);
      } else if (onComplete) {
        onComplete();
      }
    }
    requestAnimationFrame(frame);
  }, delayMs);
}

// ===== SIZE NOTE =====
// Anchor: on 2026-04-24 Vilgot was 7 weeks old and wore size 50.
// From that we back-calculate a birth date and project current size
// using a generic EU baby sizing curve (~8 weeks per step early on).
const VILGOT_BIRTH = new Date(Date.UTC(2026, 2, 5));

function daysBetween(a, b) {
  return Math.floor((b - a) / 86400000);
}

function estimateSize(weeksOld) {
  // Typical Swedish/EU baby sizing anchored so that 7 weeks ≈ size 50.
  // Babies grow roughly 3–4 cm/month in the first half-year, then slower.
  if (weeksOld < 11) return 50;   // 0–~2.5 months
  if (weeksOld < 15) return 56;   // ~2.5–3.5 months
  if (weeksOld < 22) return 62;   // ~3.5–5 months
  if (weeksOld < 30) return 68;   // ~5–7 months
  if (weeksOld < 40) return 74;   // ~7–9 months
  if (weeksOld < 52) return 80;   // ~9–12 months
  if (weeksOld < 78) return 86;   // ~12–18 months
  if (weeksOld < 104) return 92;  // ~18–24 months
  return 98;
}

function formatAge(days) {
  if (days < 90) return Math.floor(days / 7) + ' veckor';
  const months = Math.floor(days / 30.4375);
  if (months < 12) return months + ' månader';
  const years = Math.floor(months / 12);
  const rem = months - years * 12;
  if (rem === 0) return years === 1 ? '1 år' : years + ' år';
  return years + ' år och ' + rem + ' ' + (rem === 1 ? 'månad' : 'månader');
}

function monthLabel(n) {
  if (n < 12) return n === 1 ? '1 månad' : n + ' månader';
  if (n === 12) return '1 år';
  if (n % 12 === 0) return (n / 12) + ' år';
  return Math.floor(n / 12) + ' år och ' + (n % 12) + ' mån';
}

// Welds text in like a sparking torch: each char flashes white-hot, fades
// to gold, then settles. Tiny spark particles fly up at random char
// positions while the line is being written.
function initSizeNoteWeld() {
  const details = document.querySelector('details.size-note');
  if (!details) return;

  // Stash text and replace with an invisible placeholder so the box
  // reserves its full height while the panel is "empty" before the weld.
  const stash = el => {
    if (!el) return;
    if (!el.dataset.weldText) el.dataset.weldText = el.textContent;
    const ph = document.createElement('span');
    ph.className = 'weld-placeholder';
    ph.textContent = el.dataset.weldText;
    el.textContent = '';
    el.appendChild(ph);
  };
  const stashAll = () => {
    stash(document.getElementById('sizeNoteIntro'));
    details.querySelectorAll('.milestone .milestone-top, .milestone .milestone-bottom')
      .forEach(stash);
  };
  stashAll();

  details.addEventListener('toggle', () => {
    if (!details.open) return;
    // Make sure latest texts are stashed (renderSizeNote may rerun)
    stashAll();
    // Wait for the box to finish expanding, then weld the empty panel.
    setTimeout(() => weldTextInside(details), 600);
  });
}

// macOS Dock-style magnification: hover the timeline, milestones near the
// cursor scale up with a smooth Gaussian falloff. Only active once the
// open animation has settled so the two transforms don't fight.
function initSizeTimelineDock() {
  const timeline = document.getElementById('sizeProjection');
  const details = document.querySelector('details.size-note');
  if (!timeline || !details) return;

  details.addEventListener('toggle', () => {
    if (details.open) {
      setTimeout(() => timeline.classList.add('dock-active'), 750);
    } else {
      timeline.classList.remove('dock-active');
    }
  });

  const FALLOFF = 140;   // px around cursor where items react
  const MAX_SCALE = 0.85; // additional magnification at the cursor

  timeline.addEventListener('mousemove', e => {
    if (!timeline.classList.contains('dock-active')) return;
    timeline.querySelectorAll('.milestone').forEach(m => {
      const r = m.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const dist = Math.abs(e.clientX - cx);
      const t = Math.max(0, 1 - dist / FALLOFF);
      // Gaussian-ish curve so the falloff feels soft, not linear
      const factor = t * t * (3 - 2 * t);
      m.style.setProperty('--dock-scale', String(1 + factor * MAX_SCALE));
    });
  });

  timeline.addEventListener('mouseleave', () => {
    timeline.querySelectorAll('.milestone').forEach(m => {
      m.style.setProperty('--dock-scale', '1');
    });
  });
}

function weldText(el, baseDelay, charStep) {
  if (!el) return 0;
  if (!el.dataset.weldText) el.dataset.weldText = el.textContent;
  const text = el.dataset.weldText;
  el.textContent = '';
  const chars = [...text];
  chars.forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'weld-char';
    span.textContent = ch === ' ' ? ' ' : ch;
    span.style.animationDelay = (baseDelay + i * charStep) + 'ms';
    el.appendChild(span);
  });
  return baseDelay + chars.length * charStep;
}

function weldTextInside(details) {
  const intro = document.getElementById('sizeNoteIntro');
  const milestones = details.querySelectorAll('.milestone');

  const STEP = 12;
  let endTime = weldText(intro, 0, STEP);
  milestones.forEach((m, i) => {
    const top = m.querySelector('.milestone-top');
    const bot = m.querySelector('.milestone-bottom');
    const start = i * 18;
    const e1 = weldText(top, start, STEP);
    const e2 = weldText(bot, start + 30, STEP);
    endTime = Math.max(endTime, e1, e2);
  });

  // Spawn sparks at random char positions during the welding
  const sparkCount = Math.min(50, Math.round(endTime / 60));
  for (let i = 0; i < sparkCount; i++) {
    setTimeout(() => spawnWeldSpark(details), Math.random() * endTime);
  }
}

function spawnWeldSpark(scope) {
  const chars = scope.querySelectorAll('.weld-char');
  if (!chars.length) return;
  const ch = chars[Math.floor(Math.random() * chars.length)];
  const rect = ch.getBoundingClientRect();
  if (rect.width === 0) return;
  const spark = document.createElement('div');
  spark.className = 'weld-spark';
  spark.style.left = rect.left + rect.width / 2 + 'px';
  spark.style.top = rect.top + rect.height / 2 + 'px';
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
  const dist = 25 + Math.random() * 55;
  spark.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
  spark.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
  spark.style.animationDuration = 0.6 + Math.random() * 0.5 + 's';
  document.body.appendChild(spark);
  setTimeout(() => spark.remove(), 1200);
}

function renderSizeNote() {
  const intro = document.getElementById('sizeNoteIntro');
  const list = document.getElementById('sizeProjection');
  if (!intro || !list) return;

  const now = new Date();
  const days = Math.max(0, daysBetween(VILGOT_BIRTH, now));
  const weeks = Math.floor(days / 7);
  const size = estimateSize(weeks);

  intro.textContent =
    'Vilgot är nu ' + formatAge(days) + ' gammal och bär storlek ' + size + '. ' +
    'Bäbisar växer snabbast under första halvåret — ungefär 3–4 cm per månad — ' +
    'och byter oftast storlek var 6–8:e vecka fram till ca 6 månader. ' +
    'Därefter saktar tillväxten ner och varje storlek räcker i flera månader.';

  const milestones = [1, 2, 3, 4, 6, 9, 12, 18];
  list.className = 'size-timeline';
  list.innerHTML = milestones.map(function(m, i) {
    const future = new Date(now.getTime() + m * 30.4375 * 86400000);
    const fWeeks = Math.floor(daysBetween(VILGOT_BIRTH, future) / 7);
    const fSize = estimateSize(fWeeks);
    return '<li class="milestone" style="--i:' + i + '">' +
             '<span class="milestone-top">Om ' + monthLabel(m) + '</span>' +
             '<span class="milestone-dot"></span>' +
             '<span class="milestone-bottom">stl ' + fSize + '</span>' +
           '</li>';
  }).join('');
}

// ===== TITLE INTRO =====
// Split h1 and .subtitle into per-character spans with staggered animations.
// Skips on reload when scroll is not at top (return-visit shouldn't re-intro).
function splitChars(el, baseDelay, stepMs) {
  const text = el.textContent;
  el.textContent = '';
  const chars = [...text];
  chars.forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch === ' ' ? ' ' : ch;
    span.style.animationDelay = (baseDelay + i * stepMs) + 'ms';
    el.appendChild(span);
  });
  return chars.length;
}

function playTitleIntro() {
  const h1 = document.querySelector('header h1');
  const sub = document.querySelector('header .subtitle');
  if (!h1 || !sub) return;

  const titleCount = splitChars(h1, 100, 70);
  const subDelay = 100 + titleCount * 70 + 150;
  splitChars(sub, subDelay, 35);

  // Flash when the last title char lands
  const lastCharEnd = 100 + (titleCount - 1) * 70 + 900;
  setTimeout(() => h1.classList.add('flash'), lastCharEnd);
}

// ===== FIRE BURST =====
// Pure DOM fire effect focused on an element: the element itself swells and
// glows like a punch-zoom, a core fire blob throbs behind it, expanding fire
// rings push outward, and a dense swarm of embers rises and drifts. No
// confetti.
function fireBurstAt(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // Punch-zoom + ignite on the element
  el.classList.add('on-fire');
  setTimeout(() => el.classList.remove('on-fire'), 1500);

  // Core fire blob behind the number (radial gradient throb)
  const core = document.createElement('div');
  core.className = 'fire-core';
  core.style.left = cx + 'px';
  core.style.top = cy + 'px';
  document.body.appendChild(core);
  setTimeout(() => core.remove(), 1200);

  // Three expanding fire rings (gold, red, inner shock)
  [
    { cls: 'fire-ring',            life: 1100 },
    { cls: 'fire-ring fire-ring-red', life: 1300 },
    { cls: 'fire-ring fire-ring-inner', life: 700 },
  ].forEach(({ cls, life }) => {
    const ring = document.createElement('div');
    ring.className = cls;
    ring.style.left = cx + 'px';
    ring.style.top = cy + 'px';
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), life);
  });

  // Dense ember swarm with higher velocity
  const emberCount = 140;
  const colors = ['#ff3e00', '#ff6b00', '#ff9a00', '#ffcf40', '#ffed4e', '#fff'];
  for (let i = 0; i < emberCount; i++) {
    const ember = document.createElement('div');
    ember.className = 'ember';
    // Start tight around the element for a focused blast
    const spreadX = rect.width * 0.7;
    const spreadY = rect.height * 0.5;
    const startX = cx + (Math.random() - 0.5) * spreadX;
    const startY = cy + (Math.random() - 0.5) * spreadY;
    // Higher rise and wider drift for more "pressure"
    const rise = 180 + Math.random() * 420;
    const drift = (Math.random() - 0.5) * 320;
    const size = 3 + Math.random() * 8;
    const life = 900 + Math.random() * 800;
    const delay = Math.random() * 280;

    ember.style.left = startX + 'px';
    ember.style.top = startY + 'px';
    ember.style.width = size + 'px';
    ember.style.height = size + 'px';
    ember.style.background = colors[Math.floor(Math.random() * colors.length)];
    ember.style.setProperty('--drift', drift + 'px');
    ember.style.setProperty('--rise', -rise + 'px');
    ember.style.animation = 'emberRise ' + life + 'ms ease-out ' + delay + 'ms forwards';
    document.body.appendChild(ember);
    setTimeout(() => ember.remove(), life + delay + 50);
  }
}

// ===== BUY WARP =====
// Clicking a "Köp" button launches a hyperspace warp: the whole page zooms
// forward with a starfield streaking outward, fades to pitch black, and then
// the target URL opens. Works for target="_blank" too — afterwards the
// original page returns to normal so the lookbook is still there.
function initBuyWarp() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.buy-btn');
    if (!btn || !btn.href) return;
    e.preventDefault();
    warpTo(btn.href, btn.target || '_self');
  });
}

function warpTo(url, target) {
  const ox = window.scrollX + window.innerWidth / 2;
  const oy = window.scrollY + window.innerHeight / 2;
  document.body.style.transformOrigin = `${ox}px ${oy}px`;
  document.documentElement.style.perspectiveOrigin = `${ox}px ${oy}px`;
  // Clip body to viewport rect so off-screen content stays invisible
  // during the warp (the version that looked right).
  const top = window.scrollY;
  const bottom = Math.max(0, document.body.scrollHeight - window.scrollY - window.innerHeight);
  document.body.style.clipPath = `inset(${top}px 0 ${bottom}px 0)`;
  document.documentElement.classList.add('warping');

  // Navigate after the warp-out fully finishes + a small hold at the
  // vanished point so the page is clearly gone before the new tab opens.
  const OPEN_AT = 750;
  setTimeout(() => {
    if (target === '_self' || target === '') {
      window.location.href = url;
    } else if (url) {
      window.open(url, target);
    }
  }, OPEN_AT);

  // Don't auto-restore. Wait until the user returns to this tab.
  let restored = false;
  let wentHidden = false;

  const doRestore = () => {
    if (restored) return;
    restored = true;
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', onFocus);

    document.documentElement.classList.remove('warping');
    // Force a reflow so the browser commits the removal before we apply
    // the new class; prevents the restore animation from being skipped.
    void document.documentElement.offsetWidth;
    document.documentElement.classList.add('warping-restore');
    setTimeout(() => {
      document.documentElement.classList.remove('warping-restore');
      document.body.style.transformOrigin = '';
      document.body.style.clipPath = '';
      document.documentElement.style.perspectiveOrigin = '';
    }, 280);
  };

  const onVis = () => {
    if (document.visibilityState === 'hidden') {
      wentHidden = true;
    } else if (wentHidden && document.visibilityState === 'visible') {
      doRestore();
    }
  };
  const onFocus = () => { if (wentHidden) doRestore(); };

  // Attach listeners BEFORE window.open so the parent tab's visibility
  // transition to hidden is actually captured. If we waited until after,
  // we'd miss the hidden event and the fallback timer (4s) would fire.
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus', onFocus);

  // Fallback: if the tab never loses visibility, restore after 4s
  setTimeout(() => { if (!wentHidden) doRestore(); }, OPEN_AT + 4000);
}

// ===== CARD IMAGE LONG-PRESS ZOOM =====
// Holding a card image zooms a clone up to near-fullscreen; releasing slams
// it back into the card with an impact animation. Touch + mouse supported.
function initCardLongPress() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  let state = null;

  grid.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // Ignore clicks on arrows / dots / buy button so the carousel still works
    if (e.target.closest('.arrow, .dot, .buy-btn')) return;
    const img = e.target.closest('.card-carousel img.card-img');
    if (!img) return;
    e.preventDefault();
    state = startCardZoom(img);
  });

  function finish() {
    if (state) {
      endCardZoom(state);
      state = null;
    }
  }
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  // If the pointer leaves the window (drag-off), treat as release
  window.addEventListener('blur', finish);
}

function startCardZoom(img) {
  const rect = img.getBoundingClientRect();
  const clone = img.cloneNode(false);
  clone.removeAttribute('loading');
  clone.className = 'card-zoom-clone';
  Object.assign(clone.style, {
    position: 'fixed',
    left: rect.left + 'px',
    top: rect.top + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    margin: '0',
    zIndex: '99999',
    objectFit: 'cover',
    transformOrigin: 'center center',
    willChange: 'transform',
    pointerEvents: 'none',
    borderRadius: '12px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(201,169,110,0.3)',
  });
  document.body.appendChild(clone);

  const backdrop = document.createElement('div');
  backdrop.className = 'card-zoom-backdrop';
  document.body.appendChild(backdrop);
  backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, fill: 'forwards' });

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxScale = Math.min((vw * 0.94) / rect.width, (vh * 0.94) / rect.height);
  const dx = vw / 2 - (rect.left + rect.width / 2);
  const dy = vh / 2 - (rect.top + rect.height / 2);

  const growAnim = clone.animate(
    [
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${dx}px, ${dy}px) scale(${maxScale})` },
    ],
    {
      duration: 900,
      easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
      fill: 'forwards',
    }
  );

  return { clone, backdrop, growAnim, img };
}

function endCardZoom(state) {
  const { clone, backdrop, growAnim, img } = state;
  // Freeze the grow animation wherever it's currently at, then launch a
  // meteor-fall: the clone accelerates down to the card with a vertical
  // squash on impact.
  const curTransform = getComputedStyle(clone).transform;
  growAnim.cancel();
  clone.style.transform = curTransform;

  const returnAnim = clone.animate(
    [
      { transform: curTransform,                                        offset: 0 },
      // 70%: near the target, moving fast (ease-in buildup)
      { transform: 'translate(0,0) scale(1.25) rotate(3deg)',           offset: 0.7,
        easing: 'cubic-bezier(0.8, 0, 0.9, 0.4)' },
      // 78%: IMPACT — slightly compressed vertical squash ("squash & stretch")
      { transform: 'translate(0, 4px) scale(1.22, 0.72) rotate(-1deg)', offset: 0.78 },
      // 90%: rebound overshoot
      { transform: 'translate(0,0) scale(0.92, 1.12) rotate(1deg)',     offset: 0.9 },
      // 96%: micro
      { transform: 'translate(0,0) scale(1.03) rotate(0)',              offset: 0.96 },
      // 100%: settled
      { transform: 'translate(0,0) scale(1) rotate(0)',                 offset: 1 },
    ],
    {
      duration: 440,
      easing: 'linear',
      fill: 'forwards',
    }
  );
  backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' });

  // Fire the impact FX a hair before the clone finishes its squash so the
  // crunch on the card and the crater ripple land together.
  const IMPACT_AT = 340; // ms into the 440ms return animation
  const card = img.closest('.card');
  const cardRect = card ? card.getBoundingClientRect() : img.getBoundingClientRect();
  const impactCX = cardRect.left + cardRect.width / 2;
  const impactCY = cardRect.top + cardRect.height / 2;

  setTimeout(() => {
    if (card) {
      card.classList.remove('card-impact');
      void card.offsetWidth;
      card.classList.add('card-impact');
      setTimeout(() => card.classList.remove('card-impact'), 700);
    }
    spawnImpactRing(impactCX, impactCY);
    triggerCraterShockwave(impactCX, impactCY, card);
    // Screen shake on body
    document.body.classList.remove('meteor-shake');
    void document.body.offsetWidth;
    document.body.classList.add('meteor-shake');
    setTimeout(() => document.body.classList.remove('meteor-shake'), 650);
  }, IMPACT_AT);

  returnAnim.onfinish = () => {
    clone.remove();
    backdrop.remove();
  };
}

// Concentric shock ring at the impact point
function spawnImpactRing(cx, cy) {
  const ring = document.createElement('div');
  ring.className = 'meteor-ring';
  ring.style.left = cx + 'px';
  ring.style.top = cy + 'px';
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 850);

  const ring2 = document.createElement('div');
  ring2.className = 'meteor-ring meteor-ring-gold';
  ring2.style.left = cx + 'px';
  ring2.style.top = cy + 'px';
  document.body.appendChild(ring2);
  setTimeout(() => ring2.remove(), 700);
}

// Push neighbouring cards outward from the impact like a crater shockwave.
// Closer cards get a stronger push and react sooner; they spring back on a
// bouncy ease so the crater fills back in.
function triggerCraterShockwave(cx, cy, hitCard) {
  const maxDistance = 550;
  const maxPush = 46;
  const cards = document.querySelectorAll('#grid .card:not(.hidden)');
  cards.forEach(c => {
    if (c === hitCard) return;
    const r = c.getBoundingClientRect();
    const ccx = r.left + r.width / 2;
    const ccy = r.top + r.height / 2;
    const dx = ccx - cx;
    const dy = ccy - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    if (dist > maxDistance) return;
    const strength = 1 - dist / maxDistance;
    const nx = dx / dist;
    const ny = dy / dist;
    const pushX = nx * maxPush * strength;
    const pushY = ny * maxPush * strength;
    const delay = Math.min(dist * 0.4, 150);
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

// ===== BOOM FX =====
// Multi-layer screen effect: white flash, three-stage shockwave, speed lines,
// zoom-punch, and aggressive screen shake. Pure DOM, no libraries.
function triggerBoomFX(cx, cy) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const px = cx * vw;
  const py = cy * vh;

  // White flash
  const flash = document.createElement('div');
  flash.className = 'boom-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 800);

  // Three sequential shockwaves in different colors
  [
    { cls: 'boom-wave',       remove: 1100 },
    { cls: 'boom-wave boom-wave-slow', remove: 1500 },
    { cls: 'boom-wave boom-wave-red',  remove: 1300 },
  ].forEach(({ cls, remove }) => {
    const w = document.createElement('div');
    w.className = cls;
    w.style.left = px + 'px';
    w.style.top = py + 'px';
    document.body.appendChild(w);
    setTimeout(() => w.remove(), remove);
  });

  // Speed lines radiating from center (anime-style impact)
  const lines = document.createElement('div');
  lines.className = 'boom-lines';
  lines.style.left = px + 'px';
  lines.style.top = py + 'px';
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

// ===== HEADER GOLD GLITTER =====
// Continuously spawns tiny sparkle stars across the h1 area. Each sparkle
// pops in, twinkles, fades out. Pauses while the explosion debounce is
// active so it doesn't fight the boom FX.
function initHeaderGlitter() {
  const h1 = document.querySelector('header h1');
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
  const x = r.left + Math.random() * r.width;
  const y = r.top + Math.random() * r.height;
  const size = 4 + Math.random() * 8;
  sparkle.style.left = x + 'px';
  sparkle.style.top = y + 'px';
  sparkle.style.setProperty('--glitter-size', size + 'px');
  sparkle.style.animationDuration = 0.7 + Math.random() * 0.5 + 's';
  document.body.appendChild(sparkle);
  setTimeout(() => sparkle.remove(), 1300);
}

// ===== HEADER EXPLOSION =====
// Click the header: every character flies to a random point across the
// viewport, hovers, then slams back into place with a multi-burst confetti
// explosion. Debounced while an animation is in flight.
function initHeaderExplosion() {
  const header = document.querySelector('header');
  const h1 = document.querySelector('header h1');
  if (!header || !h1) return;

  header.style.cursor = 'pointer';
  header.addEventListener('click', () => {
    if (header.dataset.exploding === 'true') return;
    header.dataset.exploding = 'true';

    const chars = [
      ...document.querySelectorAll('header h1 .char'),
      ...document.querySelectorAll('header .subtitle .char'),
    ];
    if (!chars.length) { delete header.dataset.exploding; return; }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const flyDuration = 2600;
    let latestEnd = 0;

    // Brief charge-up visual on the header itself: a short inward pulse +
    // glow that sells the "gathering energy before the blast" feeling.
    header.classList.add('boom-charging');
    setTimeout(() => header.classList.remove('boom-charging'), 520);

    chars.forEach((ch, i) => {
      const rect = ch.getBoundingClientRect();
      const originCX = rect.left + rect.width / 2;
      const originCY = rect.top + rect.height / 2;
      // Random point anywhere in the viewport
      const destCX = Math.random() * vw;
      const destCY = Math.random() * vh;
      const dx = destCX - originCX;
      const dy = destCY - originCY;
      const rot = (Math.random() - 0.5) * 1440; // up to ±720°
      const scaleOut = 1.5 + Math.random() * 2;
      const delay = i * 25;
      latestEnd = Math.max(latestEnd, delay + flyDuration);

      ch.style.position = 'relative';
      ch.style.zIndex = '9999';

      // Rubber-band: charge → stretch out decelerating → final pull → snap
      // back accelerating → explode with overshoot. No hover/pause.
      const anim = ch.animate(
        [
          // 0%: rest
          { transform: 'translate(0,0) rotate(0deg) scale(1)', offset: 0,
            easing: 'cubic-bezier(0.55, 0, 0.9, 0.2)' },
          // 10%: anticipation pull-in (small charge)
          { transform: `translate(${-dx * 0.09}px, ${-dy * 0.09}px) rotate(${-rot * 0.05}deg) scale(0.65)`,
            offset: 0.1,
            easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
          // 58%: letters stretched out to max — decelerating the whole way,
          // like a rubber band reaching its limit
          { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${scaleOut})`,
            offset: 0.58,
            easing: 'linear' },
          // 64%: extra micro-stretch past target (final tension pull, still slowing)
          { transform: `translate(${dx * 1.06}px, ${dy * 1.06}px) rotate(${rot * 1.03}deg) scale(${scaleOut * 0.95})`,
            offset: 0.64,
            easing: 'cubic-bezier(0.7, 0, 0.55, 0.15)' },
          // 88%: SNAP back — hard ease-in accelerates toward origin,
          // overshooting with an oversized scale on impact
          { transform: 'translate(0,0) rotate(0deg) scale(1.55)', offset: 0.88,
            easing: 'cubic-bezier(0.3, 1.3, 0.4, 1)' },
          // 94%: undershoot
          { transform: 'translate(0,0) rotate(0deg) scale(0.92)', offset: 0.94,
            easing: 'ease-out' },
          // 100%: settle
          { transform: 'translate(0,0) rotate(0deg) scale(1)', offset: 1 },
        ],
        {
          duration: flyDuration,
          delay,
          fill: 'both',
        }
      );
      anim.onfinish = () => {
        ch.style.zIndex = '';
        ch.style.position = '';
        ch.style.transform = '';
      };
    });

    // BOOM: multi-layer explosion when chars slam back into place
    const hRect = h1.getBoundingClientRect();
    const cx = (hRect.left + hRect.width / 2) / vw;
    const cy = (hRect.top + hRect.height / 2) / vh;
    const returnAt = flyDuration * 0.88;
    const palette = ['#c9a96e', '#e4d5b7', '#fff', '#ff6b6b', '#ffcf40', '#ff3860'];

    // Screen flash + shockwave + shake overlay
    setTimeout(() => {
      triggerBoomFX(cx, cy);
    }, returnAt);

    if (typeof confetti !== 'undefined') {
      // Layer 1: absolutely massive 360° blast from the title
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
      [0, 90, 180].forEach((t, idx) => {
        const v = 85 + idx * 15;
        setTimeout(() => confetti({
          particleCount: 320, spread: 100, angle: 60,
          startVelocity: v, origin: { x: -0.05, y: 0.5 + idx * 0.15 },
          colors: palette, scalar: 1.3, ticks: 320,
        }), returnAt + t);
        setTimeout(() => confetti({
          particleCount: 320, spread: 100, angle: 120,
          startVelocity: v, origin: { x: 1.05, y: 0.5 + idx * 0.15 },
          colors: palette, scalar: 1.3, ticks: 320,
        }), returnAt + t);
      });
      // Bottom uppercuts from all four corners
      setTimeout(() => confetti({
        particleCount: 240, spread: 60, angle: 55, startVelocity: 115,
        origin: { x: 0.08, y: 1.1 }, colors: palette, scalar: 1.4, ticks: 360,
      }), returnAt + 160);
      setTimeout(() => confetti({
        particleCount: 240, spread: 60, angle: 125, startVelocity: 115,
        origin: { x: 0.92, y: 1.1 }, colors: palette, scalar: 1.4, ticks: 360,
      }), returnAt + 160);
      // Golden downpour across the whole top edge
      [0.2, 0.5, 0.8].forEach((x, idx) => {
        setTimeout(() => confetti({
          particleCount: 300, spread: 160, startVelocity: 40,
          origin: { x: x, y: -0.1 }, colors: palette,
          gravity: 1.7, scalar: 1.2, ticks: 450,
        }), returnAt + 220 + idx * 60);
      });
      // Fire-sparks: tiny fast warm particles
      setTimeout(() => confetti({
        particleCount: 400, spread: 360, startVelocity: 200,
        origin: { x: cx, y: cy },
        colors: ['#ffcf40', '#ff6b6b', '#fff'],
        gravity: 0.4, scalar: 0.6, ticks: 260,
      }), returnAt + 60);
      // Final aftershock
      setTimeout(() => confetti({
        particleCount: 400, spread: 360, startVelocity: 70,
        origin: { x: cx, y: cy }, colors: palette,
        gravity: 0.95, scalar: 1.0, ticks: 300,
      }), returnAt + 650);
    }

    setTimeout(() => { delete header.dataset.exploding; }, latestEnd + 200);
  });
}

// ===== SCROLL RESTORE =====
// The initial HTML ships an empty #grid that app.js fills in. Chrome's native
// scroll restoration runs before that, so the document is too short to scroll
// into. Take manual control: persist scrollY to sessionStorage and restore it
// after renderProducts has populated the grid.
const SCROLL_KEY = 'vilgot-scroll-y';

function initScrollRestore() {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.addEventListener('beforeunload', function() {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  });
}

function restoreScroll() {
  const y = parseInt(sessionStorage.getItem(SCROLL_KEY) || '0', 10);
  if (y <= 0) return;
  // behavior: 'instant' bypasses CSS `scroll-behavior: smooth`, which would
  // animate the jump and leave scrollY at 0 when celebrateOnLoad samples.
  window.scrollTo({ top: y, left: 0, behavior: 'instant' });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  initScrollRestore();
  initTheme();
  renderSizeNote();
  initSizeNoteWeld();
  initSizeTimelineDock();
  playTitleIntro();
  initHeaderExplosion();
  initHeaderGlitter();
  renderProducts();
  initCardLongPress();
  initBuyWarp();
  restoreScroll();
  initBackToTop();
  setTimeout(celebrateOnLoad, 300);
});
