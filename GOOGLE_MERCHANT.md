# Product feeds - Google Merchant Center & Pinterest

Supabase is the only place product data lives. The website, the Product JSON-LD
on each product page, the sitemap and the Google Merchant Center feed are all
generated from the same rows, so they cannot disagree with each other.

```
Supabase products table
        |
        +-- /api/products ........... the website (client-rendered)
        +-- Product JSON-LD ......... injected into product page HTML server-side
        +-- /api/google-shopping-feed  Google Merchant Center
        +-- /api/pinterest-feed ..... Pinterest catalogs
        +-- /sitemap.xml ............ search engines
```

## The endpoints

**Google:** https://dwellingdream.shop/api/google-shopping-feed
**Pinterest:** https://dwellingdream.shop/api/pinterest-feed

- RSS 2.0 with the `xmlns:g="http://base.google.com/ns/1.0"` namespace
- `Content-Type: application/xml; charset=utf-8`
- Cached 30 minutes (`max-age=1800`)
- Public and read-only. It contains only what already appears on the product
  pages; the Supabase service key never leaves the server.
- Suitable for Merchant Center's scheduled URL fetch and Pinterest's daily
  data-source ingestion.

Both are built from the same product rows by the same code, but written out in
each platform's own dialect. The values below come from each platform's
published sample feed - sending the wrong spelling gets items rejected:

| Field | Google | Pinterest |
|---|---|---|
| `g:availability` | `in_stock` / `out_of_stock` | `In Stock` / `Out of Stock` |
| `g:condition` | `new` | `New` |
| `g:identifier_exists` | `no` | `FALSE` |
| `g:shipping` | one block per country in `SHIPPING_COUNTRIES` | `US`, `0 USD` |
| `g:tax` | omitted | `US`, rate `0`, `tax_ship n` |

Everything else - id, title, description, link, images, price, brand, mpn,
product_type, google_product_category - is identical, so the two catalogs can
never disagree about a product.

`g:shipping` is `0` because nothing is ever shipped. Google raises "products
are set to show in countries that lack shipping information" even for digital
goods, so the Google feed emits one free-shipping block per country in
`SHIPPING_COUNTRIES` (`lib/product-feed.js` and `lib/product_feed.py`).

**That list must match the countries targeted in Merchant Center.** Adding a
country there does not make the price valid there: Google requires the price
currency to match the target country, and this store prices only in USD. A
USD-priced feed targeting the UK will keep producing currency errors no matter
what shipping says.

**`g:tax` rate is `0` because the store prices tax-inclusive.** That field tells
Pinterest how much tax to *add on top of* the advertised price; since $16.00 is
exactly what the buyer pays, the amount added is zero. Rate `0` means "nothing
is added to the shown price" - it is **not** a claim that the product is
exempt, and it says nothing about what you owe or remit.

Google is not sent a tax attribute at all: it is US-only there, and Google
prefers account-level tax settings (Merchant Center -> Settings -> Sales tax)
over per-item values. Everywhere outside the US Google requires feed prices to
be tax-inclusive, which they already are.

**If the store ever starts adding tax at checkout, `PINTEREST_TAX` must change
in the same release** - otherwise Pinterest advertises a price lower than
buyers are actually charged, which is a policy violation. It lives in
`lib/product-feed.js` and `lib/product_feed.py`.

If Supabase is unreachable the endpoint returns **503**, never an empty feed.
That is deliberate: Google reads an empty feed as "delist everything".

## Field mapping

| Google attribute | Source | Notes |
|---|---|---|
| `g:id` | `products.id` | Immutable row id. Survives renames and price changes. |
| `title` | `products.title` | Collapsed whitespace, capped at 150 chars |
| `description` | `products.description` | Capped at 5000 chars |
| `link` | derived | `…/Dwelling%20Dream%20Product.dc.html?slug={slug}` |
| `g:image_link` | `products.images[0]` | First HTTPS image |
| `g:additional_image_link` | `products.images[1..10]` | Up to 10 extra |
| `g:price` | `products.price` + `products.currency` | e.g. `16.00 USD` |
| `g:availability` | `products.active` | `true` → `in_stock`, `false` → `out_of_stock` |
| `g:brand` | constant | Always `Dwelling Dream` — see below |
| `g:condition` | constant | `new` |
| `g:identifier_exists` | constant | `no` — these products have no GTIN |
| `g:mpn` | `products.sku` | Omitted if the row has no SKU |
| `g:product_type` | `products.category` | `Paint Color Palettes > {category}` |
| `g:google_product_category` | category map | Unset by default — see below |

### Why `brand` is always "Dwelling Dream"

`products.category` holds a paint manufacturer (Behr, Sherwin Williams,
Benjamin Moore). That is the paint the palette refers to, **not** the brand of
the thing being sold. Sending `g:brand = Sherwin Williams` would tell Google
these are official Sherwin-Williams products, which is a misrepresentation and
a trademark risk. The manufacturer goes in `g:product_type` instead.

### No GTIN / UPC / EAN

These products have none, and inventing them violates Google policy. The feed
sends `g:identifier_exists = no` and identifies items by brand + `g:mpn` (SKU).

### Google product category

Set to **`Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork`**
(taxonomy id 500044) for every internal category.

Three earlier values were rejected. Read this before changing it:

| Value | Merchant Center response |
|---|---|
| *unset* | Warning 157 - missing, may limit visibility |
| `Home & Garden > Decor` | Warning 126 - only two levels deep |
| `Media > Books > E-books` | **ERROR** - "Digital books not supported and cannot be listed on Shopping" |

The ebooks value was the worst outcome: **Google bans digital books from
Shopping outright**, so it did not merely warn, it disqualified every item.
Depth is not worth an error - if the current value is ever rejected, fall back
to `Home & Garden > Decor`, which only warns.

The value must be a **verbatim** path from Google's published taxonomy. An
unrecognised path is a hard error, not a warning. Check any replacement against
the official file before shipping it:

```bash
curl -s https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt \
  | grep -F "Media > Books > E-books"
```

To change it, edit the map in **both**:

- `lib/product-feed.js` → `GOOGLE_PRODUCT_CATEGORY`
- `lib/product_feed.py` → `GOOGLE_PRODUCT_CATEGORY`

All three internal categories currently share one value via
`DEFAULT_GOOGLE_PRODUCT_CATEGORY`. To give a category its own value, set it
explicitly:

```js
const GOOGLE_PRODUCT_CATEGORY = {
  'Behr': DEFAULT_GOOGLE_PRODUCT_CATEGORY,
  'Sherwin Williams': 'Media > Books > E-books',
  'Benjamin Moore': DEFAULT_GOOGLE_PRODUCT_CATEGORY
};
```

Taxonomy reference: https://support.google.com/merchants/answer/6324436

## Everyday tasks

All of these are done in the admin panel or Supabase. **Nothing needs a code
change or a redeploy** — the feed reads live data on every fetch.

| Task | How | Effect on the feed |
|---|---|---|
| **Add a product** | Admin panel → Add product | Appears on the next Google fetch |
| **Change a price** | Admin panel → edit → Update | New price everywhere at once |
| **Disable a product** | Set `active = false` in Supabase | Drops out of feed and sitemap |
| **Change an image** | Admin panel → edit images | `image_link` follows automatically |
| **Change Google category** | Edit the map in both `lib/` files | Needs a deploy |

Because slugs are derived from category + title, **renaming a product changes
its URL**. The feed `id` stays pinned to the row id, so Google keeps tracking
the same product, but the old URL will 404 for anyone who bookmarked it.

## Availability

`active` is the only publication state the schema has — there is no draft,
sold-out or hidden flag. Digital downloads never run out of stock, so:

- `active = true` → `in_stock`
- `active = false` → excluded from the feed and the sitemap entirely

A product is also excluded if it is missing a title, description, valid price,
or any HTTPS image. That is a safety net, not a feature — fix the row.

## Validation

```bash
node scripts/validate-feed.js                       # data only, from Supabase
node scripts/validate-feed.js http://localhost:3000 # also fetch the local endpoint
node scripts/validate-feed.js https://dwellingdream.shop
```

Checks duplicate ids, missing titles/descriptions/prices/images, invalid
currencies, non-HTTPS URLs, colliding slugs, XML well-formedness, the Google
namespace, and that no credential appears in the feed body. Exits non-zero on
failure, so it can gate a deploy.

## Testing

**Locally**

```bash
node server.js
curl -s http://localhost:3000/api/google-shopping-feed | head -40
curl -s "http://localhost:3000/Dwelling%20Dream%20Product.dc.html?slug=sherwin-williams-retreat-color-palette" \
  | grep -o '<script type="application/ld+json">.*</script>'
```

**Production**

```bash
curl -sI https://dwellingdream.shop/api/google-shopping-feed   # expect 200 + application/xml
node scripts/validate-feed.js https://dwellingdream.shop
```

Google's own tools:
- Rich Results Test — https://search.google.com/test/rich-results (paste a product URL)
- Schema validator — https://validator.schema.org/

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Feed returns 503 | Supabase unreachable | Check `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` env vars |
| Feed is empty | No product passes `is_listable` | Run the validator — usually a missing image or price |
| A product is missing | `active = false`, or missing a required field | Run the validator; it names the row and the reason |
| Google: "missing GTIN" | Expected | `identifier_exists = no` is already sent; no action |
| Google: "image not accessible" | Image not public | Images live in the public `product-images` bucket; confirm the URL loads signed out |
| Price mismatch warning | Page and feed disagree | Should be impossible — both read the same row. Check for a stale CDN cache. |
| Feed 404s | Deploy did not land | Confirm the build completed and the Node app restarted |

## Architecture notes

- `lib/product-feed.js` is used by `server.js` (the deployed runtime).
- `lib/product_feed.py` is a mirror used by `server.py` (parallel implementation).
  **Any change to one must be made to the other.** Their output is byte-identical
  apart from the feed's `lastBuildDate`.
- Product pages are **client-rendered** for prices and images, but the
  `<title>`, description, canonical, OG tags and **JSON-LD are injected
  server-side** by `injectProductMeta()` before the HTML is sent. Crawlers get
  structured data without executing JavaScript.
- A URL whose slug matches no product gets the generic page and **no** JSON-LD,
  rather than another product's data.

## Pinterest setup

1. Pinterest Business account -> **Catalogs** -> add a data source.
2. Choose the hosted-file / URL option and paste:
   `https://dwellingdream.shop/api/pinterest-feed`
3. Format is **XML (RSS)**; set currency **USD** and your country.
4. Pinterest ingests once daily - no scheduling to configure beyond that.
5. Claim the domain first (the `p:domain_verify` tag is already in the
   homepage `<head>`), otherwise the catalog will not publish.
6. Pinterest requires the same policy pages Google does: refund/returns policy
   and contact details on the site.

Pinterest reports per-item problems under Catalogs -> Diagnostics. Since the
feed is generated from Supabase, fixes are made to the product row, not to a
file - the next daily ingestion picks them up.

## Manual Merchant Center setup

The code side is done; these steps happen inside Google's console:

1. Verify and claim `dwellingdream.shop` (the verification meta tag is already
   in the homepage `<head>`).
2. Products → Feeds → Add feed → **Scheduled fetch**, URL
   `https://dwellingdream.shop/api/google-shopping-feed`, daily.
3. Set the feed's country and language. The feed is **USD**, so target a
   USD country (United States) or Google will reject the prices.
4. Merchant Center settings that are not part of the feed and must be filled in
   by hand: business info, **return/refund policy**, contact details, and tax
   settings.
5. Digital goods: confirm the account is set up for them — there is no shipping
   attribute in this feed because nothing is shipped.
6. Opt in to free listings (Growth → Manage programs).
