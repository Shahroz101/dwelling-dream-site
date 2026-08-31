// Single source of truth for everything derived from a Supabase product row:
// its public URL, its price, its images, and the three published
// representations of it - the Google Merchant Center feed, the Product JSON-LD
// embedded in the product page, and the sitemap.
//
// The point of keeping these together is that a product cannot say $16.00 on
// the page, 16.00 in JSON-LD and something else in the feed. Google treats that
// mismatch as a policy violation, so every representation below reads the same
// fields from the same row.

const SITE_ORIGIN = 'https://dwellingdream.shop';

// These palettes are Dwelling Dream's own work. The paint manufacturer named on
// a palette (Behr, Sherwin Williams, Benjamin Moore) is the paint the colors
// refer to - it is NOT the brand of the product being sold, and claiming it
// would misrepresent these as official manufacturer products. The manufacturer
// goes in product_type instead.
const BRAND = 'Dwelling Dream';

// Google's own taxonomy (https://support.google.com/merchants/answer/6324436).
// Deliberately left unset: google_product_category is optional, Google
// auto-classifies when it is absent, and a confidently-wrong category is worse
// than none. Fill in an internal category here to override, e.g.
//   'Behr': 'Home & Garden > Decor'
// Verbatim path from Google's published taxonomy (id 500044,
// taxonomy-with-ids.en-US.txt, version 2021-09-21). Must stay verbatim - an
// unrecognised path is a hard error, not a warning.
//
// Three values have been tried, and the history matters before changing it:
//   unset                      -> warning 157, "missing, may limit visibility"
//   Home & Garden > Decor      -> warning 126, only two levels deep
//   Media > Books > E-books    -> ERROR, "Digital books not supported and
//                                 cannot be listed on Shopping". Google bans
//                                 ebooks outright, so that value did not just
//                                 warn, it disqualified every item.
// Posters/Prints is four levels, is not a banned category, and is defensible
// for printable colour palettes with room photography.
// https://support.google.com/merchants/answer/6324436
const DEFAULT_GOOGLE_PRODUCT_CATEGORY = 'Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork';
const GOOGLE_PRODUCT_CATEGORY = {
  'Behr': DEFAULT_GOOGLE_PRODUCT_CATEGORY,
  'Sherwin Williams': DEFAULT_GOOGLE_PRODUCT_CATEGORY,
  'Benjamin Moore': DEFAULT_GOOGLE_PRODUCT_CATEGORY
};

// Google and Pinterest fetch every image in the feed in a burst. Pointed
// straight at Supabase Storage that returns HTTP 429 for a large share of them
// (reproduced: 176 of 430 requests failed), because the free tier rate-limits.
// Serving them from this site instead puts Hostinger's CDN in front, so the
// crawler hits a cached edge and Supabase is asked for each object once.
const SUPABASE_PUBLIC_IMAGE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/product-images\/(.+)$/;

function publicImageUrl(url) {
  const match = SUPABASE_PUBLIC_IMAGE.exec(String(url || ''));
  return match ? `${SITE_ORIGIN}/product-image/${match[1]}` : url;
}

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// The original rule: derive the slug from category + title. Kept because every
// URL published before products.slug existed was built this way, and those
// links must keep resolving forever.
function derivedSlug(product) {
  const title = product.title || '';
  const category = product.category || '';
  const base = title.toLowerCase().includes(category.toLowerCase()) ? title : `${category} ${title}`;
  return slugify(base);
}

// The canonical slug. Once products.slug is populated (see
// supabase/schema_product_slug.sql) a product's URL is fixed at creation and
// survives any retitle. Falls back to the derived rule when the column is
// absent or empty, so this is safe to run before that migration.
function productSlug(product) {
  const stored = typeof product.slug === 'string' ? product.slug.trim() : '';
  return stored || derivedSlug(product);
}

// A product answers to its canonical slug AND to its derived one, so a URL
// shared before a rename still lands on the right product instead of 404ing.
function matchesSlug(product, slug) {
  if (!slug) return false;
  return slug === productSlug(product) || slug === derivedSlug(product);
}

// The currency is carried in the URL rather than guessed from the visitor's
// IP. Google crawls the GB feed's links from the UK and must see the GBP
// price; a query parameter guarantees that, geo-detection does not.
function productUrl(product, code) {
  const base = `${SITE_ORIGIN}/Dwelling%20Dream%20Product.dc.html?slug=${productSlug(product)}`;
  const cfg = currencyConfig(code);
  return cfg.code === DEFAULT_CURRENCY ? base : `${base}&currency=${cfg.code}`;
}

// Note: this maps to site-hosted URLs and is used by the feeds and JSON-LD
// only. /api/products deliberately keeps returning the raw Supabase URLs,
// because the admin panel round-trips those exact strings back as keepImages
// when editing a product.
function productImages(product) {
  return (product.images || [])
    .filter(url => typeof url === 'string' && url.startsWith('https://'))
    .map(publicImageUrl);
}

function priceAmount(product) {
  const value = Number(product.price);
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : null;
}

function currencyOf(product) {
  return String(product.currency || 'USD').toUpperCase();
}

// `active` is the only publication state this schema has - there is no draft,
// sold-out or hidden flag. Digital downloads never run out of stock, so an
// active product is always in_stock.
function availabilityOf(product) {
  return product.active === false ? 'out_of_stock' : 'in_stock';
}

// `code` is the storefront currency the listing is for. A product with no
// price in that currency is not listable there - it is dropped from that
// country's feed rather than advertised at a price checkout would not honour.
function isListable(product, code = DEFAULT_CURRENCY) {
  return Boolean(
    product &&
    product.active !== false &&
    product.id &&
    (product.title || '').trim() &&
    (product.description || '').trim() &&
    priceIn(product, code) &&
    productImages(product).length
  );
}

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Google rejects raw control characters even when they are XML-escaped.
function cleanText(value, maxLength) {
  const text = String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return maxLength && text.length > maxLength ? text.slice(0, maxLength - 1).trimEnd() + '\u2026' : text;
}

function feedItem(product, code = DEFAULT_CURRENCY) {
  const images = productImages(product);
  const cfg = currencyConfig(code);
  const item = {
    id: String(product.id),
    title: cleanText(product.title, 150),
    description: cleanText(product.description, 5000),
    link: productUrl(product, cfg.code),
    image_link: images[0],
    // Google and Pinterest both accept up to 10 additional images. This was
    // temporarily cut to 4 while product images were served straight from
    // Supabase Storage, whose free tier rate-limited the crawl (Google error
    // 1205 / warning 1222, HTTP 429). Images now go through /product-image/
    // behind Hostinger's CDN, so the full set is affordable again.
    additional_image_link: images.slice(1, 11),
    availability: availabilityOf(product),
    price: `${priceIn(product, cfg.code)} ${cfg.code}`,
    currency: cfg.code,
    shippingCountry: cfg.country,
    brand: BRAND,
    condition: 'new',
    // No GTIN/UPC/EAN exists for these products and inventing one is a policy
    // violation, so tell Google none exists and identify by brand + mpn.
    identifier_exists: 'no',
    mpn: product.sku || undefined,
    product_type: product.category ? `Paint Color Palettes > ${product.category}` : 'Paint Color Palettes',
    // Digital downloads are never shipped.
    shipping_weight: undefined,
    google_product_category: GOOGLE_PRODUCT_CATEGORY[product.category] || undefined
  };
  return item;
}

// Pinterest ingests the same RSS + g: namespace shape as Google but spells
// several values differently. Taken from Pinterest's own sample feed:
//   availability      "In Stock"      (Google: in_stock)
//   condition         "New"           (Google: new)
//   identifier_exists "FALSE"         (Google: no)
// Sending Google's spellings to Pinterest gets items rejected, so the two
// dialects are generated from the same item data but written out differently.
const PINTEREST_AVAILABILITY = {
  in_stock: 'In Stock',
  out_of_stock: 'Out of Stock'
};

// Nothing is ever shipped - these are downloads - so a zero shipping cost is
// truthful. Google reported "products are set to show in countries that lack
// shipping information", which it raises even for digital goods, so both feeds
// now carry an explicit free-shipping line per targeted country.
//
// This list must match the countries targeted in Merchant Center. Adding a
// country here does NOT make the price valid there: Google requires the price
// currency to match the target country, and this store prices only in USD.
const SHIPPING_COUNTRIES = ['US', 'GB'];

// Supported storefront currencies. The site prices in USD by default; the UK
// is offered a separate fixed GBP price rather than a converted one, because
// Google requires the feed price to equal the landing-page price and a live
// rate cannot guarantee that (see supabase/schema_price_gbp.sql).
//
// `field` is the product property holding the amount, `country` is the
// Merchant Center target the matching feed is built for.
const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', field: 'price', country: 'US' },
  GBP: { code: 'GBP', symbol: '£', field: 'priceGbp', country: 'GB' }
};
const DEFAULT_CURRENCY = 'USD';

function currencyConfig(code) {
  return CURRENCIES[String(code || '').toUpperCase()] || CURRENCIES[DEFAULT_CURRENCY];
}

// Amount for a given currency, or null when this product has no price in it.
// Null means "exclude from that country's feed" - never "fall back to USD",
// which would advertise a price the checkout would not honour.
function priceIn(product, code) {
  const cfg = currencyConfig(code);
  const value = Number(product[cfg.field]);
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : null;
}
const PINTEREST_SHIPPING_COUNTRY = 'US';

// g:tax tells Pinterest how much tax to ADD on top of the advertised price.
// The store prices tax-inclusive - $16.00 is what the buyer pays - so the
// amount added at checkout is genuinely zero. Rate 0 here means "nothing is
// added to the shown price", NOT "this product is exempt from tax"; it says
// nothing about what the seller owes and remits.
//
// If the store ever switches to adding tax at checkout, this must change to
// the real rate at the same time as the checkout does, or Pinterest will
// advertise a price lower than buyers are charged.
const PINTEREST_TAX = {
  country: 'US',
  rate: 0,
  taxShip: 'n'
};

function buildFeedXml(products, options = {}) {
  const { dialect = 'google', generatedAt = new Date(), currency = DEFAULT_CURRENCY } = options;
  const pinterest = dialect === 'pinterest';
  const cfg = currencyConfig(currency);
  const items = products.filter(p => isListable(p, cfg.code)).map(p => feedItem(p, cfg.code));

  const body = items.map(item => {
    const lines = [];
    const push = (tag, value) => lines.push(`      <${tag}>${escapeXml(value)}</${tag}>`);

    push('g:id', item.id);
    push('title', item.title);
    push('description', item.description);
    push('g:product_type', item.product_type);
    if (item.google_product_category) push('g:google_product_category', item.google_product_category);
    push('link', item.link);
    push('g:image_link', item.image_link);
    push('g:condition', pinterest ? 'New' : item.condition);
    push('g:availability', pinterest ? (PINTEREST_AVAILABILITY[item.availability] || item.availability) : item.availability);
    push('g:price', item.price);
    if (item.mpn) push('g:mpn', item.mpn);
    push('g:brand', item.brand);

    if (!pinterest) {
      // One country per feed: a GBP feed ships to GB, a USD feed to US.
      // Mixing them would advertise a price in the wrong currency for a
      // country, which Google rejects.
      lines.push('      <g:shipping>');
      lines.push(`          <g:country>${escapeXml(item.shippingCountry)}</g:country>`);
      lines.push(`          <g:price>0 ${escapeXml(item.currency)}</g:price>`);
      lines.push('      </g:shipping>');
    }

    if (pinterest) {
      lines.push('      <g:tax>');
      lines.push(`          <g:country>${escapeXml(PINTEREST_TAX.country)}</g:country>`);
      lines.push(`          <g:rate>${escapeXml(PINTEREST_TAX.rate)}</g:rate>`);
      lines.push(`          <g:tax_ship>${escapeXml(PINTEREST_TAX.taxShip)}</g:tax_ship>`);
      lines.push('      </g:tax>');
      lines.push('      <g:shipping>');
      lines.push(`          <g:country>${escapeXml(PINTEREST_SHIPPING_COUNTRY)}</g:country>`);
      lines.push(`          <g:price>0 ${escapeXml(item.currency)}</g:price>`);
      lines.push('      </g:shipping>');
    }

    push('g:identifier_exists', pinterest ? 'FALSE' : item.identifier_exists);
    item.additional_image_link.forEach(url => push('g:additional_image_link', url));

    return `    <item>\n${lines.join('\n')}\n    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Dwelling Dream</title>
    <link>${escapeXml(SITE_ORIGIN)}</link>
    <description>Digital paint color palettes, guides and planners - instant download.</description>
    <lastBuildDate>${escapeXml(generatedAt.toUTCString())}</lastBuildDate>
${body}
  </channel>
</rss>
`;
}

// Mirrors feedItem() field for field so the page and the feed can never
// disagree about price, availability, image or URL.
// A product may have no price in the requested currency - a newly added one
// has no GBP price until an admin sets it. The page falls back to the default
// currency rather than rendering a null price. The feeds do NOT fall back:
// they drop the item instead, so nothing is ever advertised in a currency the
// checkout would refuse.
function effectiveCurrency(product, code) {
  const cfg = currencyConfig(code);
  return priceIn(product, cfg.code) ? cfg.code : DEFAULT_CURRENCY;
}

function productJsonLd(product, code = DEFAULT_CURRENCY) {
  const images = productImages(product);
  const cfg = currencyConfig(effectiveCurrency(product, code));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: cleanText(product.title, 150),
    description: cleanText(product.description, 5000),
    image: images.slice(0, 10),
    url: productUrl(product, cfg.code),
    brand: { '@type': 'Brand', name: BRAND },
    offers: {
      '@type': 'Offer',
      price: priceIn(product, cfg.code),
      priceCurrency: cfg.code,
      availability: availabilityOf(product) === 'in_stock'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: productUrl(product, cfg.code),
      itemCondition: 'https://schema.org/NewCondition'
    }
  };
  if (product.sku) schema.sku = product.sku;
  if (product.category) schema.category = `Paint Color Palettes > ${product.category}`;
  return schema;
}

// Developer-readable feed validation. Returns the problems that would make
// Google reject or silently drop an item, so they can be caught before a
// scheduled fetch does.
function validateProducts(products) {
  const errors = [];
  const warnings = [];
  const seenIds = new Map();
  const seenUrls = new Map();

  for (const product of products) {
    const label = product.sku || product.id || '(unknown)';

    if (!product.id) errors.push(`${label}: missing id`);
    else if (seenIds.has(String(product.id))) errors.push(`${label}: duplicate id "${product.id}" (also ${seenIds.get(String(product.id))})`);
    else seenIds.set(String(product.id), label);

    if (!(product.title || '').trim()) errors.push(`${label}: missing title`);
    if (!(product.description || '').trim()) errors.push(`${label}: missing description`);
    if (!priceAmount(product)) errors.push(`${label}: missing or invalid price (${JSON.stringify(product.price)})`);
    if (!/^[A-Z]{3}$/.test(currencyOf(product))) errors.push(`${label}: invalid currency "${product.currency}"`);

    const url = productUrl(product);
    if (!url.startsWith('https://')) errors.push(`${label}: product URL is not HTTPS`);
    if (seenUrls.has(url)) errors.push(`${label}: duplicate product URL with ${seenUrls.get(url)} - slugs collide`);
    else seenUrls.set(url, label);

    const allImages = product.images || [];
    const httpsImages = productImages(product);
    if (!allImages.length) errors.push(`${label}: no images`);
    else if (!httpsImages.length) errors.push(`${label}: no HTTPS images (${allImages.length} non-HTTPS dropped)`);
    else if (httpsImages.length < allImages.length) warnings.push(`${label}: ${allImages.length - httpsImages.length} non-HTTPS image(s) dropped`);

    if (!product.sku) warnings.push(`${label}: no SKU - item will be sent without g:mpn`);
    if (!GOOGLE_PRODUCT_CATEGORY[product.category]) warnings.push(`${label}: no google_product_category mapped for "${product.category}" - Google will auto-classify`);
    if (product.active === false) warnings.push(`${label}: inactive - excluded from feed`);
  }

  return { errors, warnings };
}

module.exports = {
  SITE_ORIGIN,
  BRAND,
  GOOGLE_PRODUCT_CATEGORY,
  slugify,
  derivedSlug,
  productSlug,
  matchesSlug,
  productUrl,
  productImages,
  publicImageUrl,
  priceAmount,
  priceIn,
  currencyConfig,
  effectiveCurrency,
  CURRENCIES,
  DEFAULT_CURRENCY,
  currencyOf,
  availabilityOf,
  isListable,
  escapeXml,
  cleanText,
  feedItem,
  buildFeedXml,
  productJsonLd,
  validateProducts
};
