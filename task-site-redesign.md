# Task: Sajt-redesign

Skapad: 2026-03-17

## Vad ska göras

### 1. Riktiga produktbilder för alla produkter

11 produkter saknar bilder och visar text-placeholders istället:
- 6 st H&M (skjorta+fluga-set, väst-set)
- 4 st Accessoarer (flat caps, newsboy caps, hängsle-set)
- 1 st Dressade Rompers (waistcoat tuxedo onesie)

Varje produkt ska ha en riktig produktbild. Hämta från butikens sajt eller sök upp produkten och ladda ned bilden.

### 2. Ta bort kategorier/sektioner

Idag grupperas produkter under 15 sektionsrubriker (The Tiny Universe, Lulu Babe, etc.). Byt till en platt lista utan sektioner. Alla produktkort i en enda ström.

### 3. Sortering: senast tillagda först

Nya produkter ska hamna överst. Befintliga produkter sorteras i omvänd ordning (högst ID först). Agenter som lägger till produkter via add-item.sh ska automatiskt hamna högst upp.

### 4. LocalStorage: spåra sedda produkter

Spara vilka produkt-ID:n användaren sett i localStorage. Vid nästa sidladdning: jämför sparade ID:n med aktuella produkter. Produkter som inte fanns förra gången = "nya".

### 5. Extrema animationer för nya produkter

När sidan laddas och det finns produkter som användaren inte sett förut: visa dem med riktigt fräna animationer. Tänk wow-faktor, inte subtilt. Exempel:
- Produktkortet flyger in från sidan
- Glöd/pulse-effekt runt kortet
- "NY!" badge med partikeleffekt
- Konfetti eller liknande vid första visningen
- Animationen ska köras en gång, sedan markeras produkten som "sedd" i localStorage

### 6. Filtrering

Användaren ska kunna filtrera produkter på:
- Brand/märke
- Prisintervall
- Storlek
- Typ (romper, kostym, accessoar, set, etc.)
- "Bara nya" (produkter man inte sett)

Filtren ska vara synliga och enkla att använda. Kombinerbara (brand + pris + storlek samtidigt).

## Nuläge

- 75 produkter, 67 med bilder, 11 med text-placeholders
- 15 sektioner med rubriker och beskrivningar
- Ingen sortering (ordning = ordning i PRODUCTS-arrayen)
- Ingen localStorage
- Ingen filtrering
- Konfetti-animation finns redan vid sidladdning (ej kopplad till nya produkter)

## Berör

- `index.html` (rendering, CSS, JavaScript)
- `add-item.sh` (kan behöva flagga `added_date` eller liknande)
- `agents/product-scout.md` (om nya fält behövs)
- Live-sajt: https://mikbol.github.io/vilgot-garderob/
