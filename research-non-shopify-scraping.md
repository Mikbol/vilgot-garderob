# Research: Scraping av icke-Shopify babyklädessajter

Undersökt: 2026-03-16. Endpoints testade med WebFetch. Kompletterar `research-shopify-json-api.md`.

---

## Sammanfattning per sajt

| Sajt | Plattform | Enkel HTTP? | Headless krävs? | Anti-bot | Rekommenderad approach |
|------|-----------|-------------|-----------------|----------|----------------------|
| childrensalon.com | Magento Enterprise | **Ja** | Nej | reCAPTCHA (vid hög volym) | requests + BeautifulSoup |
| jacadi.us / jacadi.com | SAP Commerce Cloud | **Nej** (connection reset) | Ja | Trolig WAF, stänger raw HTTP | Playwright |
| hm.com | Next.js | **Nej** (connection reset) | Ja | Aggressiv bot-detection | Playwright + __NEXT_DATA__ |
| etsy.com | Egen stack | **Delvis** (403 på sök) | Ja (för sök) | "generic_level_4" anti-bot | Etsy API v3 (officiell) |
| amazon.com | Egen stack | **Nej** (JS-renderad) | Ja | Extensiv fingerprinting | Amazon Creators API (officiell) |
| fourtinycousins.com | **Shopify** | **Ja** | Nej | Ingen | `/products.json` (redan dokumenterat) |
| aliexpress.com | React/Next.js | **Nej** | Ja (non-headless) | Akamai Bot Manager, slider CAPTCHA | Svårast. Playwright + stealth patches |

---

## 1. Childrensalon.com (BÄST FÖR SCRAPING)

### Plattform
Magento Enterprise, heavily customized, AWS-hosted.

### Fungerar med enkel HTTP
**Ja.** Testat och verifierat. Söksidan returnerar server-side rendered HTML med produktdata inbäddad som JSON i script-taggar.

### Testade endpoints

**Sökning:**
```
GET https://www.childrensalon.com/search?q=baby+bow+tie
GET https://www.childrensalon.com/search?q=baby+tuxedo
GET https://www.childrensalon.com/search?q=baby+suit+formal&age=Baby+Boy+%280-18+mths%29
```

Resultatet `q=baby+bow+tie` returnerade 136 produkter. `q=baby+suit+formal` returnerade 21 produkter med fullständig data.

### Extraherad data per produkt
- Produktnamn (t.ex. "Romano Baby Boys Ivory Tuxedo Suit")
- Pris i GBP (£42-650)
- Märke/designer (PAZ Rodriguez, Romano, Beau KiD, Fendi, etc.)
- Bild-URL: `https://www.childrensalon.com/media/catalog/product/cache/0/image/1000x1000/[hash].jpg`
- Produkt-URL: `/[brand]-[description]-[sku].html`
- Tillgängliga storlekar (i JSON-metadata)

### Söktermer som ger resultat
- `baby+tuxedo` (15 produkter)
- `baby+bow+tie` (136 produkter)
- `baby+suit+formal` (21 produkter)
- `gentleman+romper` (0 resultat, dålig term)
- `buster+suit` (borde fungera, ej testat)
- `baby+blazer`, `baby+waistcoat` (sannolikt bra)

### Anti-bot
reCAPTCHA nämns i sidfoten men triggas inte vid normala requests. `/api/*` är blockerad i robots.txt.

### Sitemaps
Tre XML-sitemaps (engelska, arabiska, ryska) under `/media/sitemap/`, men 404 vid direkt åtkomst. Sök-endpointen är bättre ingångspunkt.

### Kod-approach
```python
import requests
from bs4 import BeautifulSoup
import json

url = "https://www.childrensalon.com/search"
params = {"q": "baby tuxedo"}
resp = requests.get(url, params=params, headers={"User-Agent": "Mozilla/5.0"})
soup = BeautifulSoup(resp.text, "html.parser")
# Produktdata finns i JSON inbäddad i script-taggar
# Också parserbar från HTML-element med produktkort
```

### Bedömning
Enklaste icke-Shopify-sajten att scrapa. Server-side rendered, rik data, bra produkturval. **Prioritera denna.**

---

## 2. Jacadi.us / Jacadi.com

### Plattform
SAP Commerce Cloud (verifierat via SAP-case study). Flerlands-setup med landväljare på jacadi.com.

### Fungerar med enkel HTTP
**Nej.** Alla försök (robots.txt, kategorisidor, söksidor) gav "socket connection closed unexpectedly". SAP Commerce Cloud tycks kräva specifika headers eller JS-kapabiliteter.

### URL-mönster (observerade)
```
https://www.jacadi.us/New-Arrivals/Baby/Boy/c/m2-31-3-2
https://www.jacadi.us/Sale/c/l1-2
https://www.jacadi.us/private-sale/Baby/Newborn/c/l1-1-1-1
```
Hierarkiskt med alfanumeriska kategorikoder, typiskt för SAP Commerce.

### robots.txt (jacadi.com)
Helt öppen: `Disallow:` (tomt). Sitemap: `https://www.jacadi.com/sitemap.xml`. Men detta hjälper inte om anslutningen stängs.

### Anti-bot
Ingen synlig Cloudflare, men servern stänger aktivt raw HTTP-anslutningar. Troligen WAF eller krav på browser fingerprint.

### Kod-approach
```python
from playwright.async_api import async_playwright

async with async_playwright() as p:
    browser = await p.chromium.launch(headless=True)
    page = await browser.new_page()
    await page.goto("https://www.jacadi.us/New-Arrivals/Baby/Boy/c/m2-31-3-2")
    # Extrahera produkter från renderad DOM
```

### Bedömning
Kräver headless browser. Produktsortimentet är premium men litet. Manuell bevakning via WebFetch i Claude kan vara tillräcklig given hur sällan sortimentet ändras.

---

## 3. H&M (hm.com)

### Plattform
Next.js. Produktdata lagras i `__NEXT_DATA__` script-taggen.

### Fungerar med enkel HTTP
**Nej.** Alla försök (www2.hm.com, www.hm.com) gav "socket connection closed unexpectedly". H&M har aggressiv bot-detection.

### Officiellt API
H&M Group har ett API-portal på `portal.api.hmgroup.com`, men det är **internt** och kräver H&M-konto. Inga publika produktsök-endpoints.

### Känd datastruktur (från community)
```javascript
// I __NEXT_DATA__ script-taggen:
props.pageProps.srpProps.hits  // Sökresultat
// Varje hit: {pdpUrl, regularPrice, ...}

// Produkt-detaljer:
props.pageProps.productPageProps.aemData.productArticleDetails
```

### Sök-URL
```
https://www2.hm.com/en_us/search-results.html?q={keyword}
```

### Anti-bot
Aggressiv. Session tracking, User-Agent-filtrering, metrisk-insamling. Kräver headless browser med stealth. Community-scraprar (Apify, Stevesie) hanterar detta via proxy-rotation.

### Kod-approach
```python
from playwright.async_api import async_playwright
import json

async with async_playwright() as p:
    browser = await p.chromium.launch(headless=True)
    page = await browser.new_page()
    await page.goto("https://www2.hm.com/sv_se/search-results.html?q=baby+fluga")
    # Hämta __NEXT_DATA__
    data = await page.evaluate('''
        () => JSON.parse(document.getElementById("__NEXT_DATA__").textContent)
    ''')
    products = data["props"]["pageProps"]["srpProps"]["hits"]
```

### Bedömning
Kräver Playwright med stealth. Datan är välstrukturerad (JSON) men svårtillgänglig. H&M:s babysortiment ändras ofta, så automatisering ger värde. Men komplexiteten är hög.

---

## 4. Etsy.com

### Officiellt API (rekommenderat)
Etsy Open API v3 är det rätta verktyget här.

**Endpoint:** `findAllListingsActive` med sökparametrar.
**Rate limits:** 10 000 anrop/dag, 10/sekund.
**Auth:** OAuth 2.0 + API-nyckel (gratis att skapa).
**Registrering:** `developers.etsy.com`, kräver Etsy-konto.

### Scraping utan API
**Delvis möjligt men svårt.** Söksidor ger 403 vid rena requests. Etsy har "generic_level_4" anti-bot (bland de svåraste). Product-sidor har JSON-LD structured data inbäddad i HTML. Kategori-sidor fungerar bättre än söksidor.

### Sök-URL-mönster
```
https://www.etsy.com/search?q=baby+tuxedo+romper&ref=pagination&page=1
https://www.etsy.com/market/preemie_tuxedo
```

### Extraherad data (via JSON-LD)
Etsy bäddar in full produktinformation i JSON-LD schema-block i HTML.

### Kod-approach (API, rekommenderad)
```python
import requests

headers = {"x-api-key": "YOUR_API_KEY"}
params = {
    "keywords": "baby tuxedo romper gentleman",
    "taxonomy_id": 1281,  # Baby Clothing
    "sort_on": "created",
    "limit": 25
}
resp = requests.get(
    "https://openapi.etsy.com/v3/application/listings/active",
    headers=headers, params=params
)
```

### Bedömning
Använd det officiella API:et. Gratis, lagligt, strukturerad data, 10 000 anrop/dag räcker gott. Enda nackdelen: kräver registrering och OAuth-setup.

---

## 5. Amazon.com

### Officiellt API: Creators API (nytt, ersätter PA-API)
PA-API v5 avvecklas **30 april 2026**. Nytt: Amazon Creators API.

**Krav för åtkomst:**
- Amazon Associates-konto (affiliate)
- 10 kvalificerade sälj senaste 30 dagarna (!)
- Nya credentials (PA-API-nycklar fungerar ej)

**Endpoint:** SearchItems med keywords + category.

### Scraping utan API
**Mycket svårt.** Amazon-söksidan returnerar bara navigations-skelett i HTML. All produktdata laddas via JavaScript. Extensiv fingerprinting, session tracking, metrisk-insamling.

### Tredjepartstjänster
SerpApi, ScrapingBee, Oxylabs, Bright Data erbjuder alla Amazon-scraping-API:er. Kostar pengar men hanterar anti-bot.

### Bedömning
Amazon kräver affiliate-konto med 10 sälj/månad för API-access. Det är opraktiskt för ett lookbook-projekt. **Skippa Amazon-automatisering.** Lägg till Amazon-produkter manuellt via `add-item.sh` när du hittar dem.

---

## 6. FourTinyCousins.com

### Plattform
**Shopify** (verifierat).

### Fungerar med enkel HTTP
**Ja.** `/products.json` fungerar direkt.

### Testat
```
GET https://fourtinycousins.com/products.json
```
Returnerar 20 produkter med namn, pris, bilder. Redan dokumenterat i `research-shopify-json-api.md`.

### Bedömning
Redan hanterad. Använd Shopify-approachen.

---

## 7. AliExpress.com

### Plattform
React/Next.js, Alibaba-infrastruktur.

### Fungerar med enkel HTTP
**Nej.** JavaScript krävs. Produktdata lagras i `window.runParams` i en script-tagg, men sidan blockerar icke-browser-trafik.

### Anti-bot
**Svårast av alla.** Akamai Bot Manager, TLS fingerprinting, slider CAPTCHA, JS challenges. Klassificerad som "D:3 difficulty" (mars 2026). Headless browsers detekteras om `--headless` flaggan är satt.

### Workaround
```python
# Kräver Playwright med stealth, NON-headless (synligt fönster), residential proxy
from playwright.async_api import async_playwright

async with async_playwright() as p:
    browser = await p.chromium.launch(headless=False)  # Måste vara synligt!
    page = await browser.new_page()
    await page.goto("https://www.aliexpress.com/w/wholesale-baby-gentleman-romper.html")
    # Extrahera window.runParams
```

### Sök-URL-mönster
```
https://www.aliexpress.com/w/wholesale-baby-gentleman-romper.html
https://www.aliexpress.com/popular/baby-suit-tie.html
```

### Bedömning
Opraktiskt att automatisera. Kräver synligt browserfönster, residential proxies, och CAPTCHA-hantering. **Skippa AliExpress-automatisering.** Använd manuellt tillägg via `add-item.sh`.

---

## Google Shopping som aggregator

### SerpApi Google Shopping API
Bästa aggregator-alternativet. Söker över ALLA butiker via Google Shopping-index.

**Free tier:** 250 sökningar/månad (gratis, inget kreditkort).
**Betalt:** Från $25/månad för 1 000 sökningar.

**Returdata:** Position, titel, länk, produkt-ID, källa (butik), pris, betyg, antal recensioner.

```python
import serpapi

params = {
    "engine": "google_shopping",
    "q": "baby tuxedo romper gentleman",
    "api_key": "YOUR_KEY",
    "num": 40
}
results = serpapi.search(params)
for item in results["shopping_results"]:
    print(item["title"], item["price"], item["link"])
```

### Serper.dev (billigare alternativ)
**Free tier:** 2 500 sökningar (inget kreditkort).
**Betalt:** Från $50 för 50 000 sökningar ($1/1k), ner till $0.30/1k vid höga volymer.
Stöder Google Shopping.

### Bedömning
Google Shopping via SerpApi eller Serper.dev är det **smartaste sättet att hitta nya produkter** oavsett butik. En enda sökning täcker Childrensalon, Etsy, Amazon, H&M, och alla andra butiker som syns i Google Shopping. Nackdel: ger inte fullständig produktdata (storleksinfo, material), bara titel+pris+länk+bild. Behöver kompletterande fetch av produktsidor.

---

## Python-bibliotek: rekommendation

### Tre nivåer

| Nivå | Bibliotek | Komplexitet | Användningsfall |
|------|-----------|-------------|-----------------|
| 1. Enkel HTTP | `requests` + `BeautifulSoup` | Låg | Childrensalon, Shopify-butiker |
| 2. Headless browser | `playwright` | Medium | H&M, Jacadi, JS-renderade sajter |
| 3. Stealth browser | `playwright` + `scrapling` / `playwright-stealth` | Hög | AliExpress, hårt skyddade sajter |

### Rekommendation
Starta med nivå 1 (`requests` + `BeautifulSoup`). Det täcker Childrensalon och alla Shopify-butiker. Lägg till Playwright bara om/när du behöver H&M eller Jacadi.

**Scrapy** (ramverk) är overkill för detta projekt. Det lyser vid storskalig crawling med tusentals sidor, inte vid periodisk produktbevakning av 5-7 butiker.

### Installera
```bash
pip install requests beautifulsoup4 lxml
# Om headless behövs senare:
pip install playwright && playwright install chromium
```

---

## Rekommenderad arkitektur

### Fas 1 (enklast, starta här)

```
Google Shopping (via Serper.dev, 2 500 gratis sökningar)
    ↓ titel + pris + länk + bild
    ↓
filter_products.py (Claude eller regelbaserat)
    ↓ gentleman-stil? rätt storlek? ej duplikat?
    ↓
add-item.sh add --name "..." --price "..." --url "..." ...
```

Söktermer:
- `baby tuxedo romper`
- `baby gentleman outfit`
- `baby bow tie bodysuit`
- `baby buster suit`
- `baby waistcoat set`
- `baby blazer romper`
- `baby newsboy outfit`
- `infant formal wear`

### Fas 2 (komplettera med direkt-scraping)

```
childrensalon_scraper.py (requests + BS4)
    → Söker: baby tuxedo, baby bow tie, buster suit
    → Extraherar: namn, pris, märke, bild, URL
    → Kollar mot befintliga produkter (add-item.sh exists)
    → Lägger till nya via add-item.sh

shopify_scraper.py (redan möjligt via /products.json)
    → thetinyuniverse.com, fourtinycousins.com, lulubabe.com, etc.

etsy_search.py (Etsy API v3)
    → Söker: baby tuxedo, preemie tuxedo, gentleman romper
    → Kräver API-nyckel (gratis att skaffa)
```

### Fas 3 (bara vid behov)

Playwright för H&M och Jacadi. Motiveras bara om deras sortiment ändras tillräckligt ofta.

---

## Evidensluckor

- **H&M `__NEXT_DATA__` struktur:** Verifierad av community men ej testad direkt (connection refused). Kan ha ändrats.
- **Jacadi anti-bot:** Oklart om det är WAF, geo-blocking, eller SAP-specifikt. Behöver testas med riktig browser.
- **Etsy API v3 taxonomy_id:** Exakt ID för "Baby Clothing" behöver verifieras i API-dokumentationen.
- **Childrensalon rate limiting:** Ej testat vid högre volym. reCAPTCHA kan triggas.
- **Serper.dev Google Shopping:** Free tier verifierat via dokumentation men ej testat med faktisk API-nyckel.

---

## Slutsats

Skippa de svåra sajterna (Amazon-API, AliExpress-stealth). Starta med:

1. **Serper.dev Google Shopping** (2 500 gratis sökningar, täcker alla butiker)
2. **Childrensalon direct scraping** (enkel HTTP, bäst produktdata)
3. **Shopify `/products.json`** (redan implementerbart)
4. **Etsy API v3** (gratis, officiellt, strukturerad data)

Det ger full täckning av gentleman-babykläder utan komplex infrastruktur. Ett Python-script, en cron-job, färdigt.
