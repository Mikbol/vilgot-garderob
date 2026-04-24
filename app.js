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
  cards.forEach(card => {
    const idx = parseInt(card.dataset.idx, 10);
    const p = PRODUCTS[idx];
    const show =
      (filters.brand === 'all' || p.brand === filters.brand || (filters.brand === '__other__' && !isTopBrand(p.brand))) &&
      (filters.size === 'all' || getSizeGroup(p.size) === filters.size) &&
      matchPrice(p.price, filters.price);
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('filterCount').textContent = visible + ' av ' + PRODUCTS.length;
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
  document.getElementById('filterGroups').classList.toggle('open');
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
  document.getElementById('productCount').textContent = PRODUCTS.length + '+ plagg kuraterade';
  document.getElementById('footerCount').textContent = PRODUCTS.length + '+';

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
  renderProducts();
  restoreScroll();
  initBackToTop();
  setTimeout(celebrateOnLoad, 300);
});
