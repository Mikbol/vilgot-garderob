# Task: Sajt-redesign

Skapad: 2026-03-17

## Status: KLAR

## Mål

Alla produkter ska ha riktiga bilder. Sajten ska ha platt lista (inga sektioner), sortering senast tillagda först, localStorage för sedda produkter, extrema animationer för nya produkter, och filtrering.

## Flöde

### 1. Bilder för alla produkter ✅ KLAR

- Research: `research/research-site-redesign.md` (sektion 1)
- Beslut: `beslut-site-redesign.md` (punkt 1-3)
- Plan: `plan-fix-missing-images.md`
- Resultat: 80 produkter, alla med bilder. 5 utgångna H&M ersatta med 4 aktuella. Chrome-verifierat 83/83 bilder.

### 1b. Sajt-problem (samlingslänkar, trasig bild) ✅ KLAR

- Research: `research/research-site-issues.md`
- Plan: `plan-fix-site-issues.md`
- Resultat: 10 samlingslänkar→produktsidor, 1 trasig bild fixad (.webp→.jpg), 1 utgången Jacadi borttagen. Chrome-verifierat.

### 2. Platt lista (ta bort sektioner) ✅ KLAR

- Plan: `plan-site-redesign.md`
- Resultat: 0 sektionsrubriker, 80 kort i platt ström, senast tillagda överst.

### 3. Sortering senast tillagda först ✅ KLAR

- Resultat: reverse() vid rendering. Nya produkter från auto-discovery hamnar överst.

### 4. localStorage för sedda produkter ✅ KLAR

- Resultat: URL-baserat schema, 80 URL:er sparade. Bara nya (0) visar 0 vid andra besöket.

### 5. Extrema animationer för nya produkter ✅ KLAR

- Resultat: GSAP elastic bounce + stagger + glow + confetti per nytt kort. NY!-badge med shimmer.

### 6. Filtrering ✅ KLAR

- Resultat: Brand (topp 9 + Övriga 42), storlek (7 grupper), pris (3 intervall), bara nya. Kombinerbara. "80 av 80" räknare. Mobil 375px: collapsar till "Filter"-knapp.

## Nästa steg

1. ~~PoC~~ ✅
2. ~~Beslut~~ ✅
3. ~~Plan~~ ✅
4. ~~Exekvering~~ ✅ (Chrome-verifierad live: 80 kort, 83/83 bilder, 0 sektioner, filter fungerar, mobil OK)

## Berör

- `index.html` (rendering, CSS, JavaScript)
- Live-sajt: https://mikbol.github.io/vilgot-garderob/
