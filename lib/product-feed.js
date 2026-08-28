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
const GOOGLE_PRODUCT_CATEGORY = {};

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

function productUrl(product) {
  return `${SITE_ORIGIN}/Dwelling%20Dream%20Product.dc.html?slug=${productSlug(product)}`;
}

function productImages(product) {
  return (product.images || []).filter(url => typeof url === 'string' && url.startsWith('https://'));
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

function isListable(product) {
  return Boolean(
    product &&
    product.active !== false &&
    product.id &&
    (product.title || '').trim() &&
    (product.description || '').trim() &&
    priceAmount(product) &&
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

function feedItem(product) {
  const images = productImages(product);
  const item = {
    id: String(product.id),
    title: cleanText(product.title, 150),
    description: cleanText(product.description, 5000),
    link: productUrl(product),
    image_link: images[0],
    additional_image_link: images.slice(1, 11),
    availability: availabilityOf(product),
    price: `${priceAmount(product)} ${currencyOf(product)}`,
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

function buildFeedXml(products, generatedAt = new Date()) {
  const items = products.filter(isListable).map(feedItem);

  const body = items.map(item => {
    const lines = [
      `      <g:id>${escapeXml(item.id)}</g:id>`,
      `      <title>${escapeXml(item.title)}</title>`,
      `      <description>${escapeXml(item.description)}</description>`,
      `      <link>${escapeXml(item.link)}</link>`,
      `      <g:image_link>${escapeXml(item.image_link)}</g:image_link>`,
      ...item.additional_image_link.map(url => `      <g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`),
      `      <g:availability>${escapeXml(item.availability)}</g:availability>`,
      `      <g:price>${escapeXml(item.price)}</g:price>`,
      `      <g:brand>${escapeXml(item.brand)}</g:brand>`,
      `      <g:condition>${escapeXml(item.condition)}</g:condition>`,
      `      <g:identifier_exists>${escapeXml(item.identifier_exists)}</g:identifier_exists>`
    ];
    if (item.mpn) lines.push(`      <g:mpn>${escapeXml(item.mpn)}</g:mpn>`);
    if (item.google_product_category) lines.push(`      <g:google_product_category>${escapeXml(item.google_product_category)}</g:google_product_category>`);
    lines.push(`      <g:product_type>${escapeXml(item.product_type)}</g:product_type>`);
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
function productJsonLd(product) {
  const images = productImages(product);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: cleanText(product.title, 150),
    description: cleanText(product.description, 5000),
    image: images.slice(0, 10),
    url: productUrl(product),
    brand: { '@type': 'Brand', name: BRAND },
    offers: {
      '@type': 'Offer',
      price: priceAmount(product),
      priceCurrency: currencyOf(product),
      availability: availabilityOf(product) === 'in_stock'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: productUrl(product),
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
  priceAmount,
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
