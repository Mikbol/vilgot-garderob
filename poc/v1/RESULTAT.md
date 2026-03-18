# PoC v1: Sajt-redesign resultat

Testad: 2026-03-18
Live: https://mikbol.github.io/vilgot-garderob/poc/v1/

## Vad testades

| Feature | Implementerad | Fungerar |
|---------|--------------|----------|
| GSAP elastic bounce + stagger | Ja | Ja (visuellt bekräftat i Chrome) |
| Glow pulse (CSS @keyframes) | Ja | Ja |
| NY!-badge med shimmer | Ja | Ja |
| Konfetti per nytt kort (canvas-confetti) | Ja | Ja |
| Filter-pills (brand, storlek, pris) | Ja | Ja (Lilax-filter: 2 av 5 korrekt) |
| "Bara nya" toggle | Ja | Ja |
| Filter-räknare ("X av Y") | Ja | Ja |
| localStorage (URL-baserat) | Ja | Ja (rensa + ladda om → alla "nya" igen) |
| Simulera ny produkt | Ja | Ja (animation + konfetti triggas) |
| Mobil 375px: filter collapse | Ja | Ja ("Filter"-knapp, 2-kolumns grid) |
| Reverse-sortering (senast först) | Ja | Ja |

## Resultat

### GSAP vs alternativen

GSAP (70 KB) levererar. Elastic bounce + stagger ger den wow-faktor som eftersöks. CSS-only hade inte klarat stagger eller elastic easing. anime.js hade fungerat men GSAP:s API var enklare att jobba med (timeline, ease-namn).

**Slutsats:** GSAP är rätt val.

### Filter-pills

Fungerar bra med 4 brands i PoC. Med 36 brands i produktion behövs "Övriga"-collapse eller sökbar dropdown. Pills för storlek (4 st) och pris (3 intervall) tar inte för mycket plats.

**Slutsats:** Pills för storlek+pris. Brand behöver utvärderas med riktiga 36 brands. Eventuellt sökbar dropdown.

### Mobil (375px)

Filter collapsar till en "Filter"-knapp. Grid växlar till 2 kolumner. Fungerar. Men filter-bar tar en hel rad vid öppning. Acceptabelt.

### localStorage

URL-baserat schema fungerar. Rensa + ladda om → alla visas som "nya" med animationer. Simulera ny produkt → bara den nya animeras. Korrekt beteende.

## Vad PoC:en INTE testade

- 80 produkter (bara 5). Prestanda med GSAP-animationer på 80 kort obekräftad (men GSAP hanterar tusentals i demos).
- Riktiga storleksdata (normalisering). Bara 3 grupper i PoC, 7 behövs i produktion.
- Interaktion mellan filter och animationer (vad händer om man filtrerar medan animationer kör?).
- Auto-discovery-agenternas produkter (testar inte att add-item.sh-flödet fungerar med ny rendering).

## Beslut som PoC:en möjliggör

| Fråga | Svar |
|-------|------|
| GSAP eller anime.js eller CSS-only? | GSAP (wow-faktor bekräftad) |
| Filter-pills eller sidebar eller dropdown? | Pills (fungerar, utvärdera brand-collapse med riktigt data) |
| localStorage URL eller index? | URL (testat, stabilt) |
| Fungerar mobil? | Ja (375px testad) |
