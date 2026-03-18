# Research: Shopify Store JSON APIs for Product Scraping

Undersökt 2026-03-16. Alla endpoints verifierade med faktiska HTTP-anrop.

---

## 1. Shopify `/products.json` endpoint

Alla Shopify-butiker exponerar ett publikt JSON-API utan autentisering. Inga API-nycklar, inga headers.

### Bas-endpoint

```
GET https://STORE/products.json
```

Returnerar `{"products": [...]}` med alla publicerade produkter.

### Produktobjektets fält

Varje produkt innehåller:

| Fält | Typ | Exempel |
|------|-----|---------|
| `id` | number | `9458326864201` |
| `title` | string | `"The Puffy Skirt"` |
| `handle` | string | `"the-puffy-skirt"` (URL-slug) |
| `body_html` | string | Produktbeskrivning med HTML |
| `vendor` | string | `"The Tiny Universe"` |
| `product_type` | string | `"Skirts"` |
| `tags` | string (kommaseparerad) | `"Party, Pink, Girls"` |
| `published_at` | ISO 8601 | `"2024-01-15T10:00:00+01:00"` |
| `created_at` | ISO 8601 | |
| `updated_at` | ISO 8601 | |
| `template_suffix` | string | Oftast tom |
| `published_scope` | string | `"web"` |
| `variants` | array | Se nedan |
| `options` | array | `[{name: "Size", values: [...]}, {name: "Color", values: [...]}]` |
| `images` | array | Se nedan |
| `image` | object | Primärbilden (samma som `images[0]`) |

### Variant-objekt

Varje variant representerar en kombination av optioner (storlek + färg):

```json
{
  "id": 46853668093257,
  "title": "62 (3M) / Neon Pink",
  "option1": "62 (3M)",
  "option2": "Neon Pink",
  "option3": null,
  "sku": "SKU-123",
  "price": "850.00",
  "compare_at_price": null,
  "available": true,
  "requires_shipping": true,
  "taxable": true,
  "grams": 0,
  "position": 1,
  "product_id": 9458326864201,
  "created_at": "...",
  "updated_at": "...",
  "featured_image": null
}
```

`compare_at_price` visar originalpriset vid rea. `available` anger lagerstatus.

### Bild-objekt

```json
{
  "id": 41254678798537,
  "created_at": "...",
  "position": 1,
  "updated_at": "...",
  "product_id": 9458326864201,
  "variant_ids": [],
  "src": "https://cdn.shopify.com/s/files/1/0088/5296/3428/files/puffy-skirt.jpg?v=1234",
  "width": 1200,
  "height": 1600
}
```

Bild-URL:er på `cdn.shopify.com` kan storleksanpassas: lägg till `&width=800` eller `?width=800`.

---

## 2. Resultat per butik

### The Tiny Universe (thetinyuniverse.com) -- FUNGERAR

| Egenskap | Värde |
|----------|-------|
| API fungerar | Ja |
| Totalt produkter | ~10 (via `/products.json?limit=250&page=1`) |
| Valuta | SEK |
| Typiskt pris | 850 kr |
| Vendor | "The Tiny Universe" |
| Produkttyper | Skirts, Dresses, Tops |
| Storlekar | 62 (3M) till 140 (10Y) |
| Bilder | cdn.shopify.com, nedladdningsbara |

Verifierade endpoints:
- `/products.json` -- 10 produkter
- `/products.json?limit=1&page=2` -- returnerar "Semi-Circle Dress" (paginering fungerar)
- `/products.json?product_type=Dresses` -- filtrering fungerar (10 resultat, blandade typer renderade men Dresses inkluderade)
- `/collections.json` -- 23 collections
- `/collections/suits-tuxedos/products.json` -- produkter i specifik collection
- `/products/the-puffy-skirt.json` -- enskild produkt via handle
- `/search/suggest.json?q=dress&resources[type]=product&resources[limit]=5` -- prediktiv sökning fungerar

### Lulu Babe (lulubabe.com) -- FUNGERAR

| Egenskap | Värde |
|----------|-------|
| API fungerar | Ja |
| Totalt produkter | ~19 (sida 1: 4 st, sida 2: 15 st) |
| Valuta | AUD |
| Typiskt pris | 18.71-29.95 AUD |
| Vendor | "Lulu Babe" |
| Produkttyper | Clothing |
| Storlekar | 0-6 months, 6-12 months, 12-18 months |
| Bilder | cdn.shopify.com |
| Collections | 33 st (389 produkter i "All Items") |

Notering: `lulubabe.com.au` svarade inte (socket closed). Använd `lulubabe.com`.

### Cuddle Sleep Dream (cuddlesleepdream.com) -- FUNGERAR

| Egenskap | Värde |
|----------|-------|
| API fungerar | Ja |
| Totalt produkter | 15 (via `?limit=250`) |
| Valuta | USD |
| Typiskt pris | $19-$55 |
| Vendor | "Cuddle Sleep Dream" |
| Produkttyper | Blandade (inkl. "return" för admin-produkter) |
| Collections | 36 st (temainriktade: birthday, holiday, matching) |

Noterat: Första produkten ("Try Risk Free with Unlimited Returns", $1.98, vendor "re:do") är en admin-/returprodukt. Filtrera bort vid import genom att utesluta `vendor != "Cuddle Sleep Dream"` eller `product_type == "return"`.

### Lilax Shop (lilaxshop.com) -- FUNGERAR

| Egenskap | Värde |
|----------|-------|
| API fungerar | Ja |
| Totalt produkter | 2 |
| Valuta | USD |
| Typiskt pris | $13.99-$19.99 |
| Vendor | "Lilaxshop" |
| Produkttyper | Short, Leggings |
| Storlekar | 2Y-12Y |
| Collections | 15-16 st |

Liten butik med bara 2 produkter. Mest sportiga barnkläder, inte gentleman-stil.

### Bee Rose Boutique (beeroseboutique.com) -- FUNGERAR

| Egenskap | Värde |
|----------|-------|
| API fungerar | Ja |
| Totalt produkter | 5 |
| Valuta | USD |
| Typiskt pris | $25-$65 |
| Vendor | "Bee Rose Boutique" |
| Produkttyper | Rompers, Shoes (många saknar product_type) |
| Storlekar | preemie till 18-24 months |
| Collections | 9 st (Shop All: 87 produkter, Girls: 64, Boys: 57) |

Handstickade custom-produkter. `collections.json` visar 87 i "Shop All" men `/products.json?limit=250` returnerar bara 5. Resterande produkter är sannolikt draft/unpublished eller nåbara via collections-endpoint.

---

## 3. Alla Shopify API-endpoints

### Produkter

```
GET /products.json                              # Alla produkter
GET /products.json?limit=250                    # Max 250 per sida
GET /products.json?limit=250&page=2             # Sida 2
GET /products.json?product_type=Dresses         # Filtrera på typ
GET /products/{handle}.json                     # Enskild produkt via handle
GET /collections/{handle}/products.json         # Produkter i en collection
```

### Collections

```
GET /collections.json                           # Alla collections
```

Returnerar per collection: `id`, `title`, `handle`, `description`, `published_at`, `updated_at`, `image`, `products_count`.

### Sökning

```
GET /search/suggest.json?q=QUERY&resources[type]=product&resources[limit]=5
```

Predictive search API. Returnerar `resources.results.products[]` med: `title`, `handle`, `id`, `price`, `compare_at_price_max/min`, `body`, `tags`, `featured_image`, `available`, `vendor`, `url`.

### Enskilda produktsidor (HTML med JSON-LD)

Alla Shopify-produktsidor har `<script type="application/ld+json">` med structured data. Användbart som fallback.

---

## 4. Paginering

### Page-baserad (enkel men deprecated)

```
GET /products.json?limit=250&page=1
GET /products.json?limit=250&page=2
...tills products-arrayen är tom
```

Verifierat fungerande på alla testade butiker. Shopify har flaggat page-baserad paginering som deprecated till förmån för cursor-baserad, men den fungerar fortfarande (2026-03-16).

Tom array `{"products": []}` signalerar att det inte finns fler sidor.

### Begränsningar

- **Max `limit`:** 250 produkter per sida
- **Default `limit`:** Varierar (The Tiny Universe returnerade 6 utan limit, Lulu Babe 3)
- **Ingen `total_count`:** Svaret innehåller INTE totalt antal produkter. Man måste paginera tills arrayen är tom.
- **Ingen paginerings-metadata:** Inget `next_page`, `has_more`, eller `Link`-header i storefront-API:t.

### Rekommenderad pagineringsstrategi

```javascript
async function fetchAllProducts(store) {
  let page = 1;
  let allProducts = [];
  while (true) {
    const url = `https://${store}/products.json?limit=250&page=${page}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.products.length === 0) break;
    allProducts.push(...data.products);
    page++;
  }
  return allProducts;
}
```

### Praktisk bedömning

Ingen av de testade butikerna har mer än 250 publicerade produkter via `/products.json`. En enda request med `?limit=250` täcker hela katalogen. Paginering behövs bara som säkerhet.

---

## 5. Rate limiting

### Dokumenterat (Shopify storefront)

Shopify anger **2 requests per sekund** per IP för icke-autentiserade storefront-anrop. Källa: [Shopify API rate limits](https://shopify.dev/docs/api/usage/rate-limits).

Vid överträdelse returneras **HTTP 429 Too Many Requests** med `Retry-After`-header.

### Praktisk påverkan

| Scenario | Requests | Tid | Risk |
|----------|----------|-----|------|
| 5 butiker, 1 request var | 5 | ~2 sek | Ingen |
| 5 butiker, 2 requests var (produkter + bilder) | 10 | ~5 sek | Ingen |
| 1 butik, 10 sidor paginering | 10 | 5 sek (med paus) | Minimal |
| 1 butik, 100 bild-nedladdningar | 100 | 50 sek (med paus) | OK |

### Best practices

1. **Vänta 500ms mellan requests till samma butik.** Ger 2 req/s med marginal.
2. **Parallellisera mellan butiker, sekventiellt per butik.** Varje butik har egen rate limit.
3. **Respektera 429.** Pausa `Retry-After` sekunder och försök igen.
4. **Cacha aggressivt.** Produkter ändras sällan. Lagra `updated_at` och skippa oförändrade.
5. **Bildnedladdning via CDN** (`cdn.shopify.com`) har generösare limits än API:t. Ingen dokumenterad gräns, men håll rimlig takt.

### Implementeringsförslag

```javascript
async function rateLimitedFetch(url, delayMs = 500) {
  await new Promise(r => setTimeout(r, delayMs));
  const resp = await fetch(url);
  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get('Retry-After') || '2', 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return fetch(url);
  }
  return resp;
}
```

---

## 6. Filtering av intressanta produkter

### Via API-parametrar

- `?product_type=TYPE` fungerar men returnerar inte alltid exakt matchning (verifierat: The Tiny Universe med `?product_type=Dresses` returnerade 10 produkter av blandad typ, inklusive Dresses).
- Collection-endpoint (`/collections/{handle}/products.json`) ger mer pålitlig filtrering.

### Via collections (rekommenderat)

Relevanta collections per butik:

**The Tiny Universe:**
- `suits-tuxedos` (det vi vill ha)
- `bodys`, `dresses`, `skirts` (komplement)

**Lulu Babe:**
- `baby-boy-clothes` (103 produkter)
- `baby-girl-clothes` (128 produkter)
- `best-sellers` (26 produkter)

**Cuddle Sleep Dream:**
- Tematiserade collections. Ingen direkt "formal" collection. Behöver keyword-filter.

**Bee Rose Boutique:**
- `boys` (57), `girls` (64), `personalized` (59)

### Via tags i produktdata

Många butiker taggar produkter. Exempel från The Tiny Universe: "Party, Pink, Girls, Festkläder". Sökbart efter fetch.

---

## 7. Komplett fetch-skript (konceptuellt)

```bash
#!/bin/bash
# fetch-shopify-products.sh

STORES=(
  "thetinyuniverse.com"
  "lulubabe.com"
  "cuddlesleepdream.com"
  "beeroseboutique.com"
)

for store in "${STORES[@]}"; do
  echo "Fetching: $store"
  curl -s "https://${store}/products.json?limit=250" \
    | jq '.products[] | {
        source_id: .id,
        title: .title,
        handle: .handle,
        vendor: .vendor,
        product_type: .product_type,
        tags: .tags,
        price: .variants[0].price,
        compare_at_price: .variants[0].compare_at_price,
        available: .variants[0].available,
        sizes: [.variants[].title],
        image: .images[0].src,
        url: ("https://'" + "$store" + "'/products/" + .handle),
        updated_at: .updated_at
      }' > "raw-${store}.json"
  sleep 1
done
```

---

## 8. Sammanfattning

| Butik | API | Produkter | Valuta | Relevant? |
|-------|-----|-----------|--------|-----------|
| thetinyuniverse.com | Fungerar | ~10 | SEK | Ja (toppval, gentleman-babykläder) |
| lulubabe.com | Fungerar | ~19 | AUD | Ja (hängslen, flugor, sets) |
| cuddlesleepdream.com | Fungerar | 15 | USD | Ja (custom bow-tie bodysuits) |
| lilaxshop.com | Fungerar | 2 | USD | Nej (sportiga kläder, inte gentleman-stil) |
| beeroseboutique.com | Fungerar | 5 | USD | Ja (custom stickade, prematurstorlek) |

Alla 5 butiker har öppna JSON-API:er. Ingen kräver autentisering. Bilderna på `cdn.shopify.com` kan laddas ner direkt.

## Evidensluckor

- `?product_type=`-filtret returnerade oväntade resultat på The Tiny Universe. Collection-endpointen är mer pålitlig.
- `lulubabe.com.au` svarade inte. Bara `lulubabe.com` fungerar.
- Bee Rose visar 87 produkter i "Shop All" collection men bara 5 via `/products.json`. Collections-endpointen kan ge fler.
- Page-baserad paginering är deprecated av Shopify. Cursor-baserad kräver autentiserat API. Nuvarande page-baserad fungerar men kan försvinna.
- Shopify rate limit på 2 req/s är per IP. Om GitHub Actions kör från delad IP kan andra klienters trafik påverka.
