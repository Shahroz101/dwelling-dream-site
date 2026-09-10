const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;

// Load local .env (KEY=VALUE per line) without a dependency - real
// process env vars (e.g. set by a hosting platform) take precedence.
function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads'); // legacy local-disk fallback for the /uploads/ route only
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
// A generated password has to be printed - it exists nowhere else, so the log
// is the only way to learn it. A configured one must NOT be, which is what
// this flag distinguishes at startup below.
const ADMIN_PASSWORD_GENERATED = !ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = crypto.randomBytes(9).toString('hex');
  console.log(`No ADMIN_PASSWORD set - generated one for this run: ${ADMIN_PASSWORD}`);
  console.log('Set ADMIN_USERNAME/ADMIN_PASSWORD env vars to use a fixed login instead.');
}
const sessions = new Map();

// Products, orders, product images, and digital files all live in Supabase
// (Postgres via PostgREST for the records, Storage for the actual image/file
// bytes) - nothing persists on local disk, so a redeploy can never wipe
// anything a store owner has added through the admin panel.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY env vars are required (Project Settings -> API in the Supabase dashboard).');
  process.exit(1);
}
const IMAGES_BUCKET = 'product-images';
const DIGITAL_BUCKET = 'digital-files';

// Checkout is intentionally allowed to be unconfigured - the rest of the site
// (catalog, admin, existing orders and their downloads) must keep working even
// if the Stripe keys are missing. Routes that need Stripe check
// payments.isConfigured() themselves and answer with a clear message instead
// of crashing the whole server at startup.
//
// The store prices, charges and feeds everything in USD. Stripe presents each
// buyer their own local payment methods and handles conversion, so no
// exchange-rate handling belongs in this codebase. Orders already placed keep
// whatever currency was stored on the row.
const ORDER_CURRENCY = 'USD';

// Bundled with every purchase, regardless of which product(s) were bought -
// uploaded once to Storage, referenced here by fixed id/path. New products
// never need these attached manually.
const GLOBAL_DIGITAL_FILES = [
  { id: 'global-paint-guide', name: 'Paint Guide.pdf', storedName: 'global/paint-guide.pdf', size: 11322276 },
  { id: 'global-project-planner', name: 'Project Planner.pdf', storedName: 'global/project-planner.pdf', size: 2469852 }
];

const DOWNLOAD_MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.epub': 'application/epub+zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function ensureDataFolders() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function supabaseRequest(pathAndQuery, { method = 'GET', body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase ${method} ${pathAndQuery} failed: ${res.status} ${detail}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function supabaseStorageUpload(bucket, objectPath, content, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': contentType || 'application/octet-stream'
    },
    body: content
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase Storage upload to ${bucket}/${objectPath} failed: ${res.status} ${detail}`);
  }
}

// Hands the browser a short-lived, single-object upload URL so a digital file
// goes straight from the admin's machine to Supabase Storage. Routing the
// bytes through this app server instead (base64 inside the product JSON) cost
// ~1.37x in size and made the admin sit through a second upload before the
// save could even begin - the reason large PDFs failed to attach on an edit.
// The signed URL is scoped to exactly this one object path and expires, so no
// service key ever reaches the browser.
async function supabaseSignedUploadUrl(bucket, objectPath) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase Storage sign for ${bucket}/${objectPath} failed: ${res.status} ${detail}`);
  }
  const data = await res.json();
  if (!data || !data.url) throw new Error('Supabase Storage returned no signed upload URL.');
  return `${SUPABASE_URL}/storage/v1${data.url}`;
}

// Returns the stored object's real metadata, or null when it isn't there.
// Used to confirm a browser-uploaded file actually landed before we attach its
// name to a product - the client's word alone is never enough.
async function supabaseStorageInfo(bucket, objectPath) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/info/${bucket}/${objectPath}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch (error) {
    return null;
  }
}

async function supabaseStorageDownload(bucket, objectPath) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function supabaseStorageDelete(bucket, objectPath) {
  if (!objectPath) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
  } catch (error) {
    // best-effort cleanup - a missing/already-gone object is not an error
  }
}

function supabasePublicUrl(bucket, objectPath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
}

function storageObjectKey(url, bucket) {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/`;
  if (typeof url === 'string' && url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }
  return null;
}

function rowToProduct(row) {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug || null,
    title: row.title,
    description: row.description,
    category: row.category,
    price: Number(row.price),
    priceGbp: row.price_gbp === null || row.price_gbp === undefined ? null : Number(row.price_gbp),
    currency: row.currency || ORDER_CURRENCY,
    active: row.active !== undefined ? Boolean(row.active) : true,
    images: row.images || [],
    digitalFiles: row.digital_files || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function readProducts() {
  const rows = (await supabaseRequest('products?select=*&order=created_at.desc')) || [];
  return rows.map(rowToProduct);
}

// Slug/URL/price/feed logic lives in one module so the product page, its
// JSON-LD, the Google Merchant Center feed and the sitemap can never disagree
// about a product - see lib/product-feed.js.
const productFeed = require('./lib/product-feed');
const imageVariants = require('./lib/image-variants');
const mailer = require('./lib/mailer');
const payments = require('./lib/payments');
const { SITE_ORIGIN, productSlug } = productFeed;

// Mirrors the client-side matching in Dwelling Dream Product.dc.html's
// loadSelectedProduct(): a slug/id present but unmatched must NOT silently
// fall back to a different product - that's the bug this function exists
// to avoid repeating server-side.
function resolveProductForQuery(searchParams, products) {
  const slug = searchParams.get('slug') || '';
  const productId = searchParams.get('id') || searchParams.get('sku') || '';

  if (slug) {
    const match = products.find(p => productFeed.matchesSlug(p, slug));
    return { product: match || null, status: match ? 'found' : 'not_found' };
  }
  if (productId) {
    const match = products.find(p => String(p.id) === productId || String(p.sku) === productId);
    return { product: match || null, status: match ? 'found' : 'not_found' };
  }
  return { product: products[0] || null, status: 'none_specified' };
}

// Server-side <title>/meta/OG injection for the product page, keyed off the
// resolved product - fixes the bug where crawlers, ad-quality bots and
// social previews (none of which reliably wait for the client-side fetch)
// saw one hardcoded product's data regardless of the URL's slug.
function injectProductMeta(htmlText, product, currency) {
  const esc = value => String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const title = product.title || 'Paint Color Palette';
  const category = product.category || '';
  const description = product.description || 'A nine-color coordinated paint palette. Instant digital download.';
  const pageTitle = category && !title.toLowerCase().includes(category.toLowerCase())
    ? `${title} | Dwelling Dream`
    : `${title} — Dwelling Dream`;
  const images = product.images || [];
  const imageUrl = images[0] ? productFeed.publicImageUrl(images[0]) : `${SITE_ORIGIN}/assets/dd2-bundle-palette.webp`;
  const canonicalUrl = productFeed.productUrl(product, currency);

  htmlText = htmlText.replace(/<title>.*?<\/title>/s, `<title>${esc(pageTitle)}</title>`);
  htmlText = htmlText.replace(/<meta name="description" content=".*?" \/>/s, `<meta name="description" content="${esc(description)}" />`);

  const ogTags = [
    `<link rel="canonical" href="${esc(canonicalUrl)}" />`,
    `<meta property="og:title" content="${esc(pageTitle)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:image" content="${esc(imageUrl)}" />`,
    `<meta property="og:url" content="${esc(canonicalUrl)}" />`,
    `<meta property="og:type" content="product" />`
  ].join('\n') + '\n';

  // Product JSON-LD is injected server-side, from the same Supabase row that
  // renders the page, so crawlers get it in the initial HTML response - the
  // visible price is filled in later by client-side JS, which Google is not
  // guaranteed to wait for. `</` is escaped so a description containing
  // "</script>" cannot break out of the script element.
  const jsonLd = JSON.stringify(productFeed.productJsonLd(product, currency)).replace(/</g, '\\u003c');
  const structuredData = `<script type="application/ld+json">${jsonLd}</script>\n`;

  htmlText = htmlText.replace('</helmet>', ogTags + structuredData + '</helmet>');

  if (images.length) {
    htmlText = htmlText.replace(
      '<img src="/assets/dd2-bundle-palette.webp" alt="Palette preview"',
      `<img src="${esc(productFeed.publicImageUrl(images[0]))}" alt="${esc(title)}"`
    );
  }

  // Render the visible product data into the HTML too, not just the metadata.
  // The page otherwise ships "$0.00" and "Loading description..." and fills
  // them in from /api/products after load. Google fetches the landing page to
  // check it against the feed and does not reliably run that JavaScript, so it
  // saw $0.00 where the feed said 16.00 USD - a price mismatch, which is a
  // disapproval reason. The client still populates these afterwards with the
  // identical values, so nothing double-renders or flickers.
  const activeCurrency = productFeed.effectiveCurrency(product, currency);
  const amount = productFeed.priceIn(product, activeCurrency);
  const symbol = productFeed.currencyConfig(activeCurrency).symbol;
  const priceLabel = amount ? `${symbol}${amount}` : '';

  // Replaces the text inside <tag ... data-x ...>text</tag>. These placeholders
  // are single text nodes, so this stays a targeted swap rather than a parse.
  const setTextByAttr = (html, attr, value) => html.replace(
    new RegExp(`(<(\\w+)[^>]*\\b${attr}\\b[^>]*>)([^<]*)(</\\2>)`),
    (match, open, tag, _text, close) => `${open}${esc(value)}${close}`
  );

  htmlText = setTextByAttr(htmlText, 'data-product-breadcrumb', title);
  htmlText = setTextByAttr(htmlText, 'data-product-brand', category);
  htmlText = setTextByAttr(htmlText, 'data-product-summary', description);
  htmlText = setTextByAttr(htmlText, 'data-product-description', description);
  if (priceLabel) htmlText = setTextByAttr(htmlText, 'data-product-price', priceLabel);

  htmlText = htmlText.replace(/(<h1[^>]*id="p-h"[^>]*>)([^<]*)(<\/h1>)/,
    (m, open, _t, close) => `${open}${esc(title)}${close}`);

  // Anchored on the actual <button data-add> elements. A bare text replace of
  // "Add to cart — ..." matched the identical string inside the page's own
  // JavaScript too and, because [^<]* runs to the next '<', swallowed a whole
  // block of script - which killed the gallery, the swipe handlers and the
  // recommendations while the server-rendered text still looked correct.
  if (priceLabel) {
    htmlText = htmlText.replace(
      /(<button[^>]*\bdata-add\b[^>]*>)([^<]*)(<\/button>)/g,
      (match, open, _text, close) => `${open}Add to cart — ${esc(priceLabel)}${close}`
    );
  }

  return htmlText;
}

async function getProductById(productId) {
  const rows = (await supabaseRequest(`products?id=eq.${encodeURIComponent(productId)}&select=*`)) || [];
  return rows[0] ? rowToProduct(rows[0]) : null;
}

// products.slug may not exist yet (see supabase/schema_product_slug.sql), and
// PostgREST rejects an insert naming an unknown column - so probe once and
// remember. Until the migration runs, slugs stay derived and nothing breaks.
let slugColumnSupported = null;
// Which column holds the payment provider's reference for an order. It was
// created as paypal_order_id; renaming it to payment_ref is optional tidying,
// so both are supported and the rename can happen whenever, without having to
// land in the same breath as a deploy.
let paymentRefColumnName = null;
async function paymentRefColumn() {
  if (paymentRefColumnName !== null) return paymentRefColumnName;
  try {
    await supabaseRequest('orders?select=payment_ref&limit=1');
    paymentRefColumnName = 'payment_ref';
  } catch (error) {
    paymentRefColumnName = 'paypal_order_id';
  }
  return paymentRefColumnName;
}

async function supportsSlugColumn() {
  if (slugColumnSupported !== null) return slugColumnSupported;
  try {
    await supabaseRequest('products?select=slug&limit=1');
    slugColumnSupported = true;
  } catch (error) {
    slugColumnSupported = false;
  }
  return slugColumnSupported;
}

// Same pattern for price_gbp (see supabase/schema_price_gbp.sql). Before that
// migration runs the column does not exist, and naming it in a write would be
// rejected by PostgREST - so the GBP price is simply not persisted yet.
let priceGbpColumnSupported = null;
async function supportsPriceGbpColumn() {
  if (priceGbpColumnSupported !== null) return priceGbpColumnSupported;
  try {
    await supabaseRequest('products?select=price_gbp&limit=1');
    priceGbpColumnSupported = true;
  } catch (error) {
    priceGbpColumnSupported = false;
  }
  return priceGbpColumnSupported;
}

// Normalises the admin's GBP input: blank/absent -> null (excluded from the GB
// feed), anything non-numeric or <= 0 -> null rather than a bogus price.
function normalisePriceGbp(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

async function insertProduct(product) {
  const row = {
    id: product.id,
    sku: product.sku,
    title: product.title,
    description: product.description,
    category: product.category,
    price: product.price,
    images: product.images,
    digital_files: product.digitalFiles,
    created_at: product.createdAt,
    updated_at: product.createdAt
  };
  // Set once, at creation, so a later retitle cannot move the product's URL.
  if (await supportsSlugColumn()) row.slug = productFeed.derivedSlug(product);
  if (await supportsPriceGbpColumn()) row.price_gbp = normalisePriceGbp(product.priceGbp);
  // Written explicitly rather than left to the column default, which is 'EUR'
  // from the original schema and no longer reflects what the store sells in.
  // Omitting it silently created EUR products that the storefront, the feeds
  // and checkout all then described in USD.
  row.currency = productFeed.DEFAULT_CURRENCY;
  const rows = await supabaseRequest('products', { method: 'POST', body: row });
  return rowToProduct(rows[0]);
}

async function updateProduct(productId, patch) {
  const rows = await supabaseRequest(`products?id=eq.${encodeURIComponent(productId)}`, { method: 'PATCH', body: patch });
  return rows[0] ? rowToProduct(rows[0]) : null;
}

async function deleteProductRow(productId) {
  await supabaseRequest(`products?id=eq.${encodeURIComponent(productId)}`, { method: 'DELETE' });
}

function rowToOrder(row) {
  return {
    id: row.id,
    token: row.token,
    items: row.items || [],
    total: Number(row.total),
    paid: Boolean(row.paid),
    status: row.status || (row.paid ? 'COMPLETED' : 'PENDING'),
    currency: row.currency || ORDER_CURRENCY,
    paymentRef: row.payment_ref || row.paypal_order_id || null,
    customerEmail: row.customer_email || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function insertOrder(order) {
  const row = {
    id: order.id,
    token: order.token,
    items: order.items,
    total: order.total,
    currency: order.currency || ORDER_CURRENCY,
    paid: order.paid || false,
    status: order.status || 'PENDING',
    // Key set below, once the available column name is known.
    customer_email: order.customerEmail || null,
    created_at: order.createdAt,
    updated_at: order.updatedAt || order.createdAt
  };
  row[await paymentRefColumn()] = order.paymentRef || null;
  const rows = await supabaseRequest('orders', { method: 'POST', body: row });
  return rowToOrder(rows[0]);
}

// Looks an order up by the payment provider's own reference - now a Stripe
// Checkout session id. The column is still named paypal_order_id; see
// PAYMENT_REF_COLUMN.
async function findOrderByPaymentRef(reference) {
  const column = await paymentRefColumn();
  const rows = (await supabaseRequest(`orders?${column}=eq.${encodeURIComponent(reference)}&select=*`)) || [];
  return rows[0] ? rowToOrder(rows[0]) : null;
}

async function updateOrderStatus(orderId, status) {
  await supabaseRequest(`orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    body: { status, updated_at: new Date().toISOString() }
  });
}

async function markOrderPaid(orderId, customerEmail) {
  const rows = await supabaseRequest(`orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    body: {
      status: 'COMPLETED',
      paid: true,
      customer_email: customerEmail || null,
      updated_at: new Date().toISOString()
    }
  });
  return rows[0] ? rowToOrder(rows[0]) : null;
}

async function setOrderPaymentRef(orderId, reference) {
  const body = { updated_at: new Date().toISOString() };
  body[await paymentRefColumn()] = reference;
  await supabaseRequest(`orders?id=eq.${encodeURIComponent(orderId)}`, { method: 'PATCH', body });
}

async function findOrder(orderId, token) {
  const rows = (await supabaseRequest(`orders?id=eq.${encodeURIComponent(orderId)}&select=*`)) || [];
  const row = rows[0];
  if (!row || row.token !== token) return null;
  return rowToOrder(row);
}

async function deleteProductById(productId) {
  const product = await getProductById(productId);
  if (!product) return false;

  await deleteProductRow(productId);

  for (const image of product.images || []) {
    const key = storageObjectKey(image, IMAGES_BUCKET);
    if (key) await supabaseStorageDelete(IMAGES_BUCKET, key);
  }

  for (const digitalFile of product.digitalFiles || []) {
    if (digitalFile && digitalFile.storedName) {
      await supabaseStorageDelete(DIGITAL_BUCKET, digitalFile.storedName);
    }
  }

  return true;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.txt': 'text/plain; charset=utf-8',
    '.gif': 'image/gif'
  };
  return map[ext] || 'application/octet-stream';
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, item) => {
    const [key, value] = item.split('=');
    if (!key) return acc;
    acc[key.trim()] = (value || '').trim();
    return acc;
  }, {});
}

function isAuthorized(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token && sessions.has(token)) {
      return true;
    }
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.session;
  return Boolean(token && sessions.has(token));
}

function generateSku(title, category) {
  const cleanTitle = (title || 'product')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 4) || 'PRD';

  const cleanCategory = (category || 'general')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 4) || 'GEN';

  const unique = Math.floor(1000 + Math.random() * 9000);
  return `${cleanCategory}-${cleanTitle}-${unique}`;
}

function imageExtension(mimeType, originalName) {
  const mt = String(mimeType || '').toLowerCase();
  if (mt.includes('png')) return '.png';
  if (mt.includes('webp')) return '.webp';
  if (mt.includes('gif')) return '.gif';
  if (mt.includes('jpeg') || mt.includes('jpg')) return '.jpg';

  // The browser occasionally reports no type at all; fall back to the file's
  // own extension before giving up and calling it a jpg.
  const ext = originalName && originalName.includes('.')
    ? '.' + originalName.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';
  if (ext === '.jpeg') return '.jpg';
  return ['.png', '.webp', '.gif', '.jpg'].includes(ext) ? ext : '.jpg';
}

// Only ever a readable filename prefix - the random file id after it is what
// actually keeps stored names unique. A product being created has no sku yet,
// so its images fall back to a prefix built from the title and category.
function storedNamePrefix({ sku, title, category } = {}) {
  if (sku) return sku;
  const clean = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 4);
  return [clean(category), clean(title)].filter(Boolean).join('-') || 'FILE';
}

function buildImageStoredName(prefix, originalName, mimeType) {
  const safePrefix = String(prefix || 'FILE').toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/^-+|-+$/g, '') || 'FILE';
  return `${safePrefix}-${crypto.randomBytes(8).toString('hex')}${imageExtension(mimeType, originalName)}`;
}

async function saveBase64Image(base64String, sku) {
  if (!base64String || typeof base64String !== 'string') return null;

  const match = base64String.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const fileName = buildImageStoredName(sku, '', mimeType);
  const buffer = Buffer.from(match[2], 'base64');
  await supabaseStorageUpload(IMAGES_BUCKET, fileName, buffer, mimeType);
  return supabasePublicUrl(IMAGES_BUCKET, fileName);
}

// Product images are stored as plain URL strings, so this always resolves to a
// URL (or null). Like digital files, an image either arrives already uploaded
// straight to storage by the browser, or inline as a base64 data URL.
async function resolveImageEntry(entry, sku) {
  if (typeof entry === 'string') return saveBase64Image(entry, sku);
  if (!entry || typeof entry !== 'object') return null;
  if (typeof entry.data === 'string' && entry.data) return saveBase64Image(entry.data, sku);

  const storedName = String(entry.storedName || '');
  if (!isSafeStoredName(storedName)) return null;

  const info = await supabaseStorageInfo(IMAGES_BUCKET, storedName);
  if (!info) return null;

  // Images are uploaded browser -> Supabase directly, so this is the first
  // point the server knows a new one exists. Kick off the .avif/.webp
  // companions without awaiting: the admin should not wait seconds per image
  // for encoding, and a failure here must never fail the product save.
  queueImageVariants(storedName);

  return supabasePublicUrl(IMAGES_BUCKET, storedName);
}

// sharp is an optionalDependency and a native module. If it did not install on
// this host, variant generation is skipped and /product-image/ simply serves
// the original - so a missing encoder degrades quality-of-service, never
// availability. Never let this throw into a request handler.
let sharpModule;
let sharpUnavailable = false;
function loadSharp() {
  if (sharpModule || sharpUnavailable) return sharpModule;
  try {
    sharpModule = require('sharp');
  } catch (error) {
    sharpUnavailable = true;
    console.warn(`Image variants disabled: sharp is unavailable (${error.message})`);
  }
  return sharpModule;
}

async function queueImageVariants(storedName) {
  const sharp = loadSharp();
  if (!sharp) return;
  try {
    const source = await supabaseStorageDownload(IMAGES_BUCKET, storedName);
    if (!source) return;
    for (const [ext, contentType, encode] of [
      ['.avif', 'image/avif', img => img.avif({ quality: 50, effort: 4 })]
    ]) {
      const name = imageVariants.variantName(storedName, ext);
      if (!name || name === storedName) continue;
      const output = await encode(sharp(source, { failOn: 'none' })).toBuffer();
      await supabaseStorageUpload(IMAGES_BUCKET, name, output, contentType);
    }
  } catch (error) {
    console.warn(`Image variant generation failed for ${storedName}: ${error.message}`);
  }
}

function digitalExtension(originalName, mimeType) {
  let ext = '';
  if (originalName && originalName.includes('.')) {
    ext = '.' + originalName.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  if (!ext || ext === '.') {
    ext = { 'application/pdf': '.pdf', 'application/zip': '.zip', 'application/epub+zip': '.epub' }[mimeType] || '.bin';
  }
  return ext;
}

// The file id is carried inside the stored name so it can be recovered later
// without keeping any server-side state between signing a URL and attaching
// the finished upload to a product (this server restarts freely, and an admin
// may take minutes to finish a large upload).
function buildDigitalStoredName(prefix, originalName, mimeType) {
  const safePrefix = String(prefix || 'FILE').toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/^-+|-+$/g, '') || 'FILE';
  return `${safePrefix}-${crypto.randomBytes(8).toString('hex')}${digitalExtension(originalName, mimeType)}`;
}

function isSafeStoredName(storedName) {
  return typeof storedName === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(storedName)
    && !storedName.includes('..');
}

function digitalIdFromStoredName(storedName) {
  const match = /-([0-9a-f]{16})\.[A-Za-z0-9]+$/.exec(storedName || '');
  return match ? match[1] : crypto.randomBytes(8).toString('hex');
}

async function saveBase64File(base64String, originalName, sku) {
  if (!base64String || typeof base64String !== 'string') return null;

  const match = base64String.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const storedName = buildDigitalStoredName(sku, originalName, mimeType);
  await supabaseStorageUpload(DIGITAL_BUCKET, storedName, buffer, mimeType);

  return {
    id: digitalIdFromStoredName(storedName),
    name: (originalName || storedName).trim() || storedName,
    size: buffer.length,
    storedName
  };
}

// A digital file reaches us one of two ways: already uploaded straight to
// storage by the browser (the normal path - we only get its name back and
// verify it landed), or inline as a base64 data URL (the older path, kept so
// nothing that still posts that shape breaks). Returns null for anything that
// can't be verified, so a bad entry is dropped rather than recorded as a file
// customers would later fail to download.
async function resolveDigitalEntry(entry, sku) {
  if (!entry || typeof entry !== 'object') return null;

  if (typeof entry.data === 'string' && entry.data) {
    return saveBase64File(entry.data, entry.name, sku);
  }

  const storedName = String(entry.storedName || '');
  if (!isSafeStoredName(storedName)) return null;

  const info = await supabaseStorageInfo(DIGITAL_BUCKET, storedName);
  if (!info) return null;

  const displayName = String(entry.name || storedName).trim() || storedName;
  return {
    id: digitalIdFromStoredName(storedName),
    name: displayName,
    size: Number(info.size) || 0,
    storedName
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function serveHtmlText(res, htmlText, statusCode = 200) {
  const content = Buffer.from(htmlText, 'utf-8');
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(content);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': getMimeType(filePath),
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

function serveDownloadBytes(res, content, storedName, downloadName) {
  const ext = path.extname(storedName).toLowerCase();
  const mimeType = DOWNLOAD_MIME_TYPES[ext] || 'application/octet-stream';
  const safeName = (downloadName || storedName).replace(/[\r\n"]/g, '');

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="${safeName}"`
  });
  res.end(content);
}

function handleApiLogin(req, res) {
  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}');
      const username = String(payload.username || '').trim();
      const password = String(payload.password || '').trim();

      if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        sendJson(res, 401, { success: false, message: 'Invalid username or password.' });
        return;
      }

      const sessionId = crypto.randomBytes(24).toString('hex');
      sessions.set(sessionId, { username, createdAt: Date.now() });

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`
      });
      res.end(JSON.stringify({
        success: true,
        message: 'Login successful.',
        sessionToken: sessionId
      }));
    } catch (error) {
      sendJson(res, 400, { success: false, message: 'Invalid request body.' });
    }
  });
}

async function handleApiProducts(req, res) {
  if (req.method === 'GET') {
    // Never expose the internal storedName (the real on-disk filename) for
    // digital files - downloads only ever happen through the token-gated
    // /api/download route.
    let products;
    try {
      products = await readProducts();
    } catch (error) {
      sendJson(res, 500, { success: false, message: 'Failed to reach the product database.', error: error.message });
      return;
    }
    const publicProducts = products.map(product => ({
      ...product,
      digitalFiles: (product.digitalFiles || [])
        .filter(f => f && typeof f === 'object')
        .map(f => ({ id: f.id, name: f.name, size: f.size || 0 }))
    }));
    sendJson(res, 200, { products: publicProducts });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { success: false, message: 'Unauthorized access.' });
    return;
  }

  if (req.method === 'DELETE') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const productId = String(payload.id || '').trim();

        if (!productId) {
          sendJson(res, 400, { success: false, message: 'Product ID is required.' });
          return;
        }

        const deleted = await deleteProductById(productId);
        if (!deleted) {
          sendJson(res, 404, { success: false, message: 'Product not found.' });
          return;
        }

        sendJson(res, 200, { success: true, message: 'Product deleted successfully.' });
      } catch (error) {
        sendJson(res, 500, { success: false, message: 'Failed to delete product.', error: error.message });
      }
    });
    return;
  }

  if (req.method === 'PUT') {
    let body = '';

    req.on('data', chunk => { body += chunk; });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const productId = String(payload.id || '').trim();
        if (!productId) {
          sendJson(res, 400, { success: false, message: 'Product ID is required.' });
          return;
        }

        const existing = await getProductById(productId);
        if (!existing) {
          sendJson(res, 404, { success: false, message: 'Product not found.' });
          return;
        }

        const title = String(payload.title || '').trim();
        const description = String(payload.description || '').trim();
        const category = String(payload.category || '').trim();
        const price = Number(payload.price || 0);
        const validCategories = new Set(['Behr', 'Sherwin Williams', 'Benjamin Moore']);

        if (!title || !description || !category || price <= 0) {
          sendJson(res, 400, { success: false, message: 'Title, description, category, and price are required.' });
          return;
        }
        if (!validCategories.has(category)) {
          sendJson(res, 400, { success: false, message: 'Category must be Behr, Sherwin Williams, or Benjamin Moore.' });
          return;
        }

        const keepImages = Array.isArray(payload.keepImages) ? payload.keepImages : [];
        const newImagesRaw = Array.isArray(payload.newImages) ? payload.newImages : [];
        const keepDigitalIds = new Set(Array.isArray(payload.keepDigitalFiles) ? payload.keepDigitalFiles : []);
        const newDigitalRaw = Array.isArray(payload.newDigitalFiles) ? payload.newDigitalFiles : [];

        const sku = existing.sku || generateSku(title, category);

        // Save any newly-uploaded files first, so we know the true final counts
        // before touching anything already stored.
        const savedNewImages = [];
        for (const image of newImagesRaw) {
          const saved = await resolveImageEntry(image, sku);
          if (saved) savedNewImages.push(saved);
        }

        const savedNewDigital = [];
        for (const entry of newDigitalRaw) {
          const saved = await resolveDigitalEntry(entry, sku);
          if (saved) savedNewDigital.push(saved);
        }

        const finalImages = (existing.images || []).filter(img => keepImages.includes(img)).concat(savedNewImages);
        const finalDigital = (existing.digitalFiles || [])
          .filter(f => f && keepDigitalIds.has(f.id))
          .concat(savedNewDigital);

        if (!finalImages.length) {
          // Reject the edit without touching the product's existing files - only
          // clean up whatever we just wrote for this rejected attempt.
          for (const imagePath of savedNewImages) {
            const key = storageObjectKey(imagePath, IMAGES_BUCKET);
            if (key) await supabaseStorageDelete(IMAGES_BUCKET, key);
          }
          for (const digitalFile of savedNewDigital) {
            await supabaseStorageDelete(DIGITAL_BUCKET, digitalFile.storedName);
          }
          sendJson(res, 400, { success: false, message: 'At least one product image is required.' });
          return;
        }

        const updatedAt = new Date().toISOString();
        try {
          const patch = {
            title,
            description,
            category,
            price,
            images: finalImages,
            digital_files: finalDigital,
            updated_at: updatedAt
          };
          if (await supportsPriceGbpColumn()) patch.price_gbp = normalisePriceGbp(payload.priceGbp);
          await updateProduct(productId, patch);
        } catch (error) {
          sendJson(res, 500, { success: false, message: 'Failed to update product.', error: error.message });
          return;
        }

        // Only remove whatever was dropped from the "keep" lists after the
        // database write succeeds, so a failed update never orphans files.
        for (const imagePath of existing.images || []) {
          if (keepImages.includes(imagePath)) continue;
          const key = storageObjectKey(imagePath, IMAGES_BUCKET);
          if (key) await supabaseStorageDelete(IMAGES_BUCKET, key);
        }

        for (const digitalFile of existing.digitalFiles || []) {
          if (!digitalFile || keepDigitalIds.has(digitalFile.id)) continue;
          if (digitalFile.storedName) await supabaseStorageDelete(DIGITAL_BUCKET, digitalFile.storedName);
        }

        const updatedProduct = {
          ...existing,
          title,
          description,
          category,
          price,
          images: finalImages,
          digitalFiles: finalDigital,
          updatedAt
        };

        sendJson(res, 200, { success: true, message: 'Product updated successfully.', product: updatedProduct });
      } catch (error) {
        sendJson(res, 500, { success: false, message: 'Failed to update product.', error: error.message });
      }
    });
    return;
  }

  if (req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const title = String(payload.title || '').trim();
        const description = String(payload.description || '').trim();
        const price = Number(payload.price || 0);
        const category = String(payload.category || 'General').trim();
        const images = Array.isArray(payload.images) ? payload.images : [];
        const digitalFilesRaw = Array.isArray(payload.digitalFiles) ? payload.digitalFiles : [];

        if (!title || !description || !price || !category) {
          sendJson(res, 400, { success: false, message: 'Title, description, price, and category are required.' });
          return;
        }

        if (!images.length) {
          sendJson(res, 400, { success: false, message: 'At least one product image is required.' });
          return;
        }

        const sku = generateSku(title, category);
        const savedImages = [];
        for (const image of images) {
          const savedLink = await resolveImageEntry(image, sku);
          if (savedLink) savedImages.push(savedLink);
        }

        const savedDigitalFiles = [];
        for (const entry of digitalFilesRaw) {
          const saved = await resolveDigitalEntry(entry, sku);
          if (saved) savedDigitalFiles.push(saved);
        }

        const product = {
          id: crypto.randomUUID(),
          sku,
          title,
          description,
          price,
          priceGbp: normalisePriceGbp(payload.priceGbp),
          category,
          images: savedImages,
          digitalFiles: savedDigitalFiles,
          createdAt: new Date().toISOString()
        };

        try {
          await insertProduct(product);
        } catch (error) {
          sendJson(res, 500, { success: false, message: 'Failed to save product.', error: error.message });
          return;
        }

        sendJson(res, 201, { success: true, message: 'Product saved successfully.', product });
      } catch (error) {
        sendJson(res, 500, { success: false, message: 'Failed to store product.', error: error.message });
      }
    });
    return;
  }

  sendJson(res, 405, { success: false, message: 'Method not allowed.' });
}

// Admin-only. Reserves a name in the digital-files bucket and returns a signed
// URL the browser uploads the raw file to directly. Nothing is attached to a
// product here - the product save that follows re-checks that the object
// really exists before recording it.
function handleUploadUrl(req, res, kind) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed.' });
    return;
  }
  if (!isAuthorized(req)) {
    sendJson(res, 401, { success: false, message: 'Unauthorized access.' });
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });

  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const name = String(payload.name || '').trim();
      const contentType = String(payload.contentType || '').trim();

      if (!name) {
        sendJson(res, 400, { success: false, message: 'A file name is required.' });
        return;
      }

      let existing = null;
      const productId = String(payload.productId || '').trim();
      if (productId) existing = await getProductById(productId);

      const prefix = storedNamePrefix({
        sku: existing && existing.sku,
        title: payload.title,
        category: payload.category
      });

      const isImage = kind === 'image';
      const bucket = isImage ? IMAGES_BUCKET : DIGITAL_BUCKET;
      const storedName = isImage
        ? buildImageStoredName(prefix, name, contentType)
        : buildDigitalStoredName(prefix, name, contentType);
      const uploadUrl = await supabaseSignedUploadUrl(bucket, storedName);

      sendJson(res, 200, {
        success: true,
        id: isImage ? undefined : digitalIdFromStoredName(storedName),
        storedName,
        uploadUrl
      });
    } catch (error) {
      sendJson(res, 500, { success: false, message: 'Could not start the file upload.', error: error.message });
    }
  });
}

// Creates the order, then a Stripe Checkout session for it, and hands the
// browser the URL to send the buyer to.
//
// Public and unauthenticated, so the browser is only ever trusted to say WHICH
// products and quantities it wants. Every price below is read from Supabase.
function handleCreateCheckoutSession(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed.' });
    return;
  }
  if (!payments.isConfigured()) {
    sendJson(res, 503, { success: false, message: 'Checkout is temporarily unavailable. Please try again shortly.' });
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const requestedItems = Array.isArray(payload.items) ? payload.items : [];
      if (!requestedItems.length) {
        sendJson(res, 400, { success: false, message: 'No items to check out.' });
        return;
      }

      // The browser may ask to be charged in a supported storefront currency
      // (USD default, GBP for the UK). It only names the currency - every
      // amount still comes from Supabase, never from the request.
      const requestedCurrency = String(payload.currency || ORDER_CURRENCY).toUpperCase();
      if (!Object.prototype.hasOwnProperty.call(productFeed.CURRENCIES, requestedCurrency)) {
        sendJson(res, 400, { success: false, message: 'Unsupported currency.' });
        return;
      }
      const orderCurrency = requestedCurrency;

      let products;
      try {
        products = await readProducts();
      } catch (error) {
        sendJson(res, 500, { success: false, message: 'Failed to reach the product database.', error: error.message });
        return;
      }
      const productsById = new Map(products.map(product => [String(product.id), product]));

      const orderItems = [];
      let totalCents = 0;
      for (const entry of requestedItems) {
        if (!entry || typeof entry !== 'object') continue;
        const product = productsById.get(String(entry.id));
        if (!product) {
          sendJson(res, 400, { success: false, message: 'One or more items are no longer available.' });
          return;
        }
        if (product.active === false) {
          sendJson(res, 400, { success: false, message: `${product.title || 'This item'} is not currently available.` });
          return;
        }
        // A product with no price in the requested currency must not be sold
        // in it - refuse rather than silently charging the USD amount.
        const priceString = productFeed.priceIn(product, orderCurrency);
        if (!priceString) {
          sendJson(res, 400, { success: false, message: `${product.title || 'This item'} is not available in ${orderCurrency}.` });
          return;
        }

        const qty = Math.max(1, Math.min(20, parseInt(entry.qty, 10) || 1));
        const price = Number(priceString);
        totalCents += Math.round(price * 100) * qty;
        orderItems.push({
          productId: product.id,
          sku: product.sku || '',
          title: product.title || 'Product',
          price,
          qty,
          // Carried so the Stripe payment page can show what is being bought.
          // publicImageUrl() rewrites the Supabase Storage URL to this domain's
          // /product-image/ route, which is what Stripe's fetcher must be able
          // to reach - and what the CDN caches.
          image: (product.images || []).length ? productFeed.publicImageUrl(product.images[0]) : null,
          description: String(product.description || '').trim().slice(0, 240) || null,
          digitalFiles: (product.digitalFiles || [])
            .filter(f => f && typeof f === 'object')
            .map(f => ({ id: f.id, name: f.name, size: f.size || 0 }))
        });
      }

      if (!orderItems.length || totalCents <= 0) {
        sendJson(res, 400, { success: false, message: 'No valid items to check out.' });
        return;
      }

      // Bundled guides ride along on every order as their own line, once
      // per order (not once per item), at no extra cost.
      orderItems.push({
        productId: null,
        sku: 'GLOBAL-GUIDES',
        title: 'Included Guides',
        price: 0,
        qty: 1,
        digitalFiles: GLOBAL_DIGITAL_FILES
      });

      const order = {
        id: crypto.randomBytes(8).toString('hex'),
        token: crypto.randomBytes(24).toString('hex'),
        items: orderItems,
        total: totalCents / 100,
        currency: orderCurrency,
        status: 'PENDING',
        paid: false,
        createdAt: new Date().toISOString()
      };

      // The order row is written BEFORE the session exists, so a buyer who pays
      // can always be matched to something. An order with no session attached
      // is an abandoned checkout; an unmatched payment would be a lost sale.
      try {
        await insertOrder(order);
      } catch (error) {
        sendJson(res, 500, { success: false, message: 'Failed to save order.', error: error.message });
        return;
      }

      const session = await payments.createCheckoutSession({
        order,
        successUrl: `${SITE_ORIGIN}/order?order=${encodeURIComponent(order.id)}&token=${encodeURIComponent(order.token)}`,
        cancelUrl: `${SITE_ORIGIN}/cart`
      });

      if (!session.ok) {
        try { await updateOrderStatus(order.id, 'FAILED'); } catch (error) { /* best effort */ }
        sendJson(res, 502, { success: false, message: 'Could not start checkout. Please try again.', error: session.error });
        return;
      }

      try {
        await setOrderPaymentRef(order.id, session.id);
      } catch (error) {
        // Not fatal: the success_url still carries the order id and token, and
        // the webhook also carries the order id in metadata.
        console.error(`[order ${order.id}] could not store the checkout session id: ${error.message}`);
      }

      sendJson(res, 201, { success: true, url: session.url, orderId: order.id, token: order.token });
    } catch (error) {
      sendJson(res, 400, { success: false, message: 'Invalid request body.' });
    }
  });
}

// Marks an order paid and sends both emails. Shared by the webhook and by the
// reconcile path, and safe to call twice: it returns early if the order is
// already paid, so a webhook and a page load racing each other cannot send a
// buyer two copies of their receipt.
async function fulfilOrder(order, buyerEmail) {
  if (!order || order.paid) return order;

  const paidOrder = await markOrderPaid(order.id, buyerEmail);
  const finalOrder = paidOrder || { ...order, paid: true };
  const orderUrl = `${SITE_ORIGIN}/order?order=${encodeURIComponent(order.id)}&token=${encodeURIComponent(order.token)}`;

  // The payment is captured by this point, so every mail failure below is
  // logged and swallowed. None of it is worth failing a paid order over.
  if (buyerEmail) {
    const sent = await mailer.sendMail({ to: buyerEmail, ...mailer.orderConfirmation({ order: finalOrder, orderUrl }) });
    if (!sent.ok) console.error(`[order ${order.id}] confirmation email not sent: ${sent.error}`);
  } else {
    console.error(`[order ${order.id}] paid but Stripe returned no buyer email - no confirmation sent`);
  }

  const notified = await mailer.sendMail({
    to: mailer.SALES_TO,
    ...mailer.saleNotification({ order: finalOrder, orderUrl, buyerEmail })
  });
  if (!notified.ok) console.error(`[order ${order.id}] sale notification not sent: ${notified.error}`);

  return finalOrder;
}

// Stripe's webhook. This is what actually confirms payment: the buyer's browser
// returning to the success URL proves nothing, since anyone can visit a URL.
//
// The signature check is the entire security of this endpoint. Without it any
// caller who found the path could mark orders paid and collect the downloads,
// so an unverified request is refused rather than trusted.
function handleStripeWebhook(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed.' });
    return;
  }

  // Collected as raw bytes: Stripe signs the exact body it sent, and a parsed
  // and re-serialised copy will not verify.
  const chunks = [];
  let size = 0;
  let aborted = false;
  req.on('data', chunk => {
    if (aborted) return;
    size += chunk.length;
    if (size > 1024 * 1024) { aborted = true; res.writeHead(413); res.end(); req.destroy(); return; }
    chunks.push(chunk);
  });

  req.on('end', async () => {
    if (aborted) return;

    const verified = payments.verifyWebhook(Buffer.concat(chunks), req.headers['stripe-signature'] || '');
    if (!verified.ok) {
      console.error('[stripe] rejected an unverified webhook:', verified.error);
      sendJson(res, 400, { success: false, message: 'Signature verification failed.' });
      return;
    }

    const event = verified.event;
    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
      // Acknowledged, not acted on. Answering 2xx stops Stripe retrying events
      // this store has no interest in.
      sendJson(res, 200, { received: true });
      return;
    }

    const session = event.data.object;
    if (session.payment_status !== 'paid') {
      sendJson(res, 200, { received: true });
      return;
    }

    const orderId = (session.metadata && session.metadata.orderId) || session.client_reference_id || '';
    const buyerEmail = (session.customer_details && session.customer_details.email) || null;

    try {
      const rows = orderId ? (await supabaseRequest(`orders?id=eq.${encodeURIComponent(orderId)}&select=*`)) || [] : [];
      const order = rows[0] ? rowToOrder(rows[0]) : await findOrderByPaymentRef(session.id);
      if (!order) {
        // 200 rather than an error: retrying will not conjure the row, and a
        // failing webhook endpoint gets disabled by Stripe.
        console.error(`[stripe] paid session ${session.id} matched no order`);
        sendJson(res, 200, { received: true, matched: false });
        return;
      }
      await fulfilOrder(order, buyerEmail);
      sendJson(res, 200, { received: true });
    } catch (error) {
      // A real failure on our side - let Stripe retry.
      console.error('[stripe] webhook handling failed:', error.message);
      sendJson(res, 500, { success: false, message: 'Could not process the event.' });
    }
  });
}

// Pinterest's merchant guidelines require a return policy carrying contact
// information, and every page's footer advertised a Contact link that went
// nowhere. This is the endpoint behind /contact.
//
// The form is public and unauthenticated, so it is the one place a stranger can
// make the server send mail. Three cheap defences, in order of how much they
// actually catch: a body size cap, a honeypot field that ordinary browsers
// leave empty, and a per-IP rate limit.
const CONTACT_MAX_BODY = 16 * 1024;
const CONTACT_RATE_LIMIT = 5;              // submissions per window, per IP
const CONTACT_RATE_WINDOW_MS = 15 * 60 * 1000;
const contactSubmissions = new Map();      // ip -> timestamps[]

function contactRateLimited(ip) {
  const now = Date.now();
  const recent = (contactSubmissions.get(ip) || []).filter(t => now - t < CONTACT_RATE_WINDOW_MS);
  // Prune while we are here; without this the map grows for the life of the
  // process on a site that gets crawled.
  if (recent.length) contactSubmissions.set(ip, recent);
  else contactSubmissions.delete(ip);

  if (recent.length >= CONTACT_RATE_LIMIT) return true;
  recent.push(now);
  contactSubmissions.set(ip, recent);
  return false;
}

function handleContactSubmit(req, res) {
  // Hostinger fronts the app with its CDN, so the socket address is always the
  // proxy. The client is the first entry of X-Forwarded-For.
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket.remoteAddress || 'unknown';

  if (contactRateLimited(ip)) {
    sendJson(res, 429, { success: false, message: 'Too many messages from this address. Please try again later.' });
    return;
  }

  let body = '';
  let aborted = false;
  req.on('data', chunk => {
    if (aborted) return;
    body += chunk;
    if (body.length > CONTACT_MAX_BODY) {
      aborted = true;
      sendJson(res, 413, { success: false, message: 'That message is too long.' });
      req.destroy();
    }
  });

  req.on('end', async () => {
    if (aborted) return;

    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch (error) {
      sendJson(res, 400, { success: false, message: 'Invalid request body.' });
      return;
    }

    // Honeypot: hidden in the form, so anything that fills it is automated.
    // Answer 200 so a bot cannot tell it was caught.
    if (String(payload.website || '').trim()) {
      sendJson(res, 200, { success: true, message: 'Thanks - your message is on its way.' });
      return;
    }

    const name = String(payload.name || '').trim().slice(0, 120);
    const email = String(payload.email || '').trim().slice(0, 254);
    const message = String(payload.message || '').trim().slice(0, 5000);

    if (!name || !email || !message) {
      sendJson(res, 400, { success: false, message: 'Please fill in your name, email and message.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(res, 400, { success: false, message: 'That email address does not look right.' });
      return;
    }

    if (!mailer.isMailConfigured()) {
      // Better to say so than to accept the message and drop it silently - the
      // whole point of this page is that people can reach a human.
      console.error('[contact] submission received but SMTP is not configured');
      sendJson(res, 503, {
        success: false,
        message: 'Our contact form is temporarily unavailable. Please email contact@dwellingdream.shop directly.'
      });
      return;
    }

    const sent = await mailer.sendMail({
      to: mailer.CONTACT_TO,
      ...mailer.contactMessage({ name, email, message })
    });

    if (!sent.ok) {
      sendJson(res, 502, {
        success: false,
        message: 'We could not send that just now. Please email contact@dwellingdream.shop directly.'
      });
      return;
    }

    sendJson(res, 200, { success: true, message: 'Thanks - your message is on its way.' });
  });
}

function handleLogout(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies.session;
  if (sessionId) sessions.delete(sessionId);

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  });
  res.end(JSON.stringify({ success: true, message: 'Logged out.' }));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // www and the bare domain both served the full site with HTTP 200, so the
  // store existed at two addresses with identical content. Everything that
  // names a URL - canonical tags, OG tags, the sitemap, both product feeds -
  // uses the bare domain (SITE_ORIGIN), so that is the canonical one and www
  // is redirected onto it. Google Merchant Center claims a specific host, and
  // a site reachable at two is a reason for it to keep asking you to claim it.
  const requestHost = String(req.headers.host || '');
  if (/^www\./i.test(requestHost)) {
    const canonicalHost = requestHost.replace(/^www\./i, '');
    res.writeHead(301, {
      Location: `https://${canonicalHost}${req.url}`,
      'Cache-Control': 'public, max-age=3600'
    });
    res.end();
    return;
  }

  // Decode %20 etc. so routes/filenames with spaces (all the "Dwelling Dream
  // *.dc.html" pages) match, decoding percent-escapes in the path first.
  const reqPath = decodeURIComponent(url.pathname);

  if (reqPath === '/api/contact' && req.method === 'POST') {
    handleContactSubmit(req, res);
    return;
  }

  // Customer reviews, read from data/reviews.json.
  //
  // These are shop reviews carried over from Etsy: they are about Dwelling
  // Dream and its palettes generally, and none of them names which palette it
  // was left for. They are therefore served as one shop-wide list and labelled
  // as such on the page. They are deliberately NOT attached to individual
  // products or emitted as Product/aggregateRating structured data, because
  // presenting a review of one palette as a review of another misrepresents
  // it - and Google and Pinterest both treat product review markup that is not
  // about that product as a policy violation.
  if (reqPath === '/api/reviews' && (req.method === 'GET' || req.method === 'HEAD')) {
    let reviews = [];
    try {
      reviews = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'reviews.json'), 'utf8'));
    } catch (error) {
      // A missing or malformed file must not break the product page; the
      // section simply renders nothing.
      console.error('[reviews] could not read data/reviews.json:', error.message);
      sendJson(res, 200, { success: true, reviews: [], count: 0, average: null });
      return;
    }
    const count = reviews.length;
    const average = count
      ? Number((reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count).toFixed(2))
      : null;
    sendJson(res, 200, { success: true, reviews, count, average });
    return;
  }

  if (reqPath === '/api/login' && req.method === 'POST') {
    handleApiLogin(req, res);
    return;
  }

  if (reqPath === '/api/logout' && req.method === 'POST') {
    handleLogout(req, res);
    return;
  }

  if (reqPath === '/api/config' && req.method === 'GET') {
    // Public, non-secret runtime config the frontend needs. Stripe Checkout is
    // hosted, so the browser never needs a key at all: it asks this server for
    // a session and follows the URL it gets back. No Stripe key, publishable
    // or otherwise, appears in any response.
    sendJson(res, 200, {
      paymentsEnabled: payments.isConfigured(),
      paymentsTestMode: payments.isTestMode(),
      currency: ORDER_CURRENCY
    });
    return;
  }

  if (reqPath === '/api/products') {
    await handleApiProducts(req, res);
    return;
  }

  // Product images, served from this domain so Hostinger's CDN caches them.
  // Pointing crawlers straight at Supabase Storage got a large share of
  // requests rate-limited (HTTP 429); behind the CDN each object is fetched
  // from Supabase once and served from the edge thereafter. Immutable because
  // stored names contain a random id and are never rewritten in place.
  if (reqPath.startsWith('/product-image/') && (req.method === 'GET' || req.method === 'HEAD')) {
    const objectName = reqPath.slice('/product-image/'.length);
    if (!isSafeStoredName(objectName)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    // Serve the smallest format this client actually claims to support:
    // .avif, then .webp, then the original. The URL is always the .jpg one, so
    // product rows, feeds and JSON-LD are unaffected. A client sending */* -
    // which includes Merchant Center and Pinterest - gets the original, since
    // AVIF support in product feeds is not guaranteed.
    const candidates = imageVariants.negotiateVariants(objectName, req.headers.accept);
    let chosen = null;
    let content = null;
    for (const candidate of candidates) {
      try {
        content = await supabaseStorageDownload(IMAGES_BUCKET, candidate.name);
      } catch (error) {
        content = null;
      }
      if (content) { chosen = candidate; break; }
    }
    if (!content) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': chosen.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Without this a cache could hand an AVIF to a browser that cannot
      // decode it, because every format shares one URL.
      Vary: 'Accept',
      'Content-Length': content.length
    });
    res.end(req.method === 'HEAD' ? undefined : content);
    return;
  }

  // Google Merchant Center scheduled fetch target. Public and read-only: it
  // exposes only what already appears on the product pages, and the Supabase
  // service key never leaves this process.
  // Also answers on /google-shopping-feed.xml and /pinterest-feed.xml. Some
  // feed ingesters key off a recognised file extension, and an extensionless
  // /api/ path gives them nothing to go on.
  // Pinterest's CSV data source. Deliberately a separate endpoint from the
  // Google feed, and from the Pinterest RSS above: Pinterest specifies its
  // column formats far more precisely than its XML dialect, so this is the one
  // to point a data source at. The Google feed is untouched by any of it.
  if (['/api/pinterest-feed.csv', '/pinterest-feed.csv'].includes(reqPath)) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { success: false, message: 'Method not allowed.' });
      return;
    }

    const startedAt = Date.now();
    console.log('[pinterest-csv] feed generation started');

    let products;
    try {
      products = await readProducts();
    } catch (error) {
      // Plain-text 503 rather than an empty feed: a crawler handed zero
      // products reads that as "delist everything".
      console.error(`[pinterest-csv] aborted - product database unreachable: ${error.message}`);
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(`Product feed unavailable: could not reach the product database.\n`);
      return;
    }

    let built;
    try {
      built = productFeed.buildFeedCsv(products, { currency: 'USD' });
    } catch (error) {
      console.error(`[pinterest-csv] aborted - could not build the feed: ${error.message}`);
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Product feed unavailable.\n');
      return;
    }

    const { processed, valid, skipped } = built.stats;
    for (const item of skipped) {
      // Product ids and the reason only - no customer data, no credentials.
      console.warn(`[pinterest-csv] skipped ${item.id || '(no id)'}: ${item.reason}`);
    }
    console.log(`[pinterest-csv] processed=${processed} valid=${valid} skipped=${skipped.length} bytes=${Buffer.byteLength(built.csv)} ms=${Date.now() - startedAt}`);

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Length': Buffer.byteLength(built.csv),
      'Cache-Control': 'public, max-age=1800'
    });
    res.end(req.method === 'HEAD' ? undefined : built.csv);
    return;
  }

  if (['/api/google-shopping-feed', '/api/pinterest-feed',
       '/google-shopping-feed.xml', '/pinterest-feed.xml',
       '/api/google-shopping-feed-gb', '/google-shopping-feed-gb.xml'].includes(reqPath)) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { success: false, message: 'Method not allowed.' });
      return;
    }
    let products;
    try {
      products = await readProducts();
    } catch (error) {
      // Plain-text 503 rather than a half-built feed: Google must not be handed
      // an empty product list, which it would read as "delist everything".
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(`Product feed unavailable: could not reach the product database.\n${error.message}\n`);
      return;
    }

    const dialect = reqPath.includes('pinterest') ? 'pinterest' : 'google';
    // One feed per Merchant Center target country, each in that country's
    // currency. Google requires the feed price to match the landing page, and
    // the -gb links carry ?currency=GBP so the page renders GBP to match.
    const currency = reqPath.includes('-gb') ? 'GBP' : 'USD';
    const xml = productFeed.buildFeedXml(products, { dialect, currency });
    // Deliberately no X-Robots-Tag here. It previously said "noindex", which is
    // meant to keep the XML itself out of search results - but a feed crawler
    // that honours the header can read it as "do not use this resource" and
    // fail the whole ingestion with no explanation.
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800'
    });
    res.end(req.method === 'HEAD' ? undefined : xml);
    return;
  }

  if (reqPath === '/sitemap.xml' && req.method === 'GET') {
    let products = [];
    try {
      products = await readProducts();
    } catch (error) {
      products = [];
    }
    const esc = productFeed.escapeXml;
    const staticPaths = ['/', '/palettes', '/about', '/help', '/contact'];
    const urls = staticPaths.map(p => `  <url>\n    <loc>${esc(SITE_ORIGIN + p)}</loc>\n  </url>`);
    for (const product of products) {
      if (!productFeed.isListable(product)) continue;
      const lastmod = product.updatedAt ? String(product.updatedAt).slice(0, 10) : null;
      urls.push(
        `  <url>\n    <loc>${esc(productFeed.productUrl(product))}</loc>` +
        (lastmod ? `\n    <lastmod>${esc(lastmod)}</lastmod>` : '') +
        `\n  </url>`
      );
    }
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
    return;
  }

  if (reqPath === '/robots.txt' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    // The Allow lines come first and the feeds are never covered by a broad
    // Disallow. Relying on longest-match precedence was a mistake: it is a
    // Google extension, and a crawler that reads rules in order, or ignores
    // Allow entirely, would treat "Disallow: /api/" as blocking the feeds.
    res.end([
      'User-agent: *',
      'Allow: /api/google-shopping-feed',
      'Allow: /api/pinterest-feed',
      'Allow: /google-shopping-feed.xml',
      'Allow: /pinterest-feed.xml',
      'Allow: /api/pinterest-feed.csv',
      'Allow: /pinterest-feed.csv',
      'Allow: /product-image/',
      'Allow: /',
      'Disallow: /admin.html',
      'Disallow: /login.html',
      'Disallow: /api/download',
      'Disallow: /api/login',
      'Disallow: /api/logout',
      'Disallow: /api/checkout/',
      'Disallow: /api/stripe/',
      '',
      `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
      ''
    ].join('\n'));
    return;
  }

  if (reqPath === '/api/uploads/digital' || reqPath === '/api/uploads/image') {
    handleUploadUrl(req, res, reqPath.endsWith('/image') ? 'image' : 'digital');
    return;
  }

  if (reqPath === '/api/checkout/create-session') {
    handleCreateCheckoutSession(req, res);
    return;
  }

  if (reqPath === '/api/stripe/webhook') {
    handleStripeWebhook(req, res);
    return;
  }

  if (reqPath.startsWith('/api/orders/') && req.method === 'GET') {
    const orderId = reqPath.slice('/api/orders/'.length);
    const token = url.searchParams.get('token') || '';
    let order;
    try {
      order = await findOrder(orderId, token);
    } catch (error) {
      sendJson(res, 500, { success: false, message: 'Failed to reach the order database.', error: error.message });
      return;
    }
    if (!order) {
      sendJson(res, 404, { success: false, message: 'Order not found.' });
      return;
    }

    // The webhook is what confirms payment, but it is not instant and it can
    // fail to arrive. A buyer redirected back from Stripe would then sit in
    // front of an unpaid order holding files they have paid for. So an unpaid
    // order with a session attached is checked directly against Stripe here.
    // Payment is still established by asking Stripe, never by trusting that
    // the browser reached this URL.
    if (!order.paid && order.paymentRef && payments.isConfigured()) {
      try {
        const session = await payments.retrieveSession(order.paymentRef);
        if (session.ok && session.paid) {
          order = await fulfilOrder(order, session.email) || order;
        }
      } catch (error) {
        console.error(`[order ${order.id}] could not reconcile with Stripe: ${error.message}`);
      }
    }

    sendJson(res, 200, { success: true, order });
    return;
  }

  if (reqPath === '/api/download' && req.method === 'GET') {
    const orderId = url.searchParams.get('order') || '';
    const token = url.searchParams.get('token') || '';
    const fileId = url.searchParams.get('file') || '';

    let order;
    try {
      order = await findOrder(orderId, token);
    } catch (error) {
      sendJson(res, 500, { success: false, message: 'Failed to reach the order database.', error: error.message });
      return;
    }
    if (!order || !order.paid) {
      sendJson(res, 403, { success: false, message: "This download link is invalid or the order hasn't been paid." });
      return;
    }

    const purchasedFileIds = new Set(
      order.items.flatMap(item => (item.digitalFiles || []).map(f => f.id))
    );
    if (!purchasedFileIds.has(fileId)) {
      sendJson(res, 404, { success: false, message: 'File not found in this order.' });
      return;
    }

    let found = GLOBAL_DIGITAL_FILES.find(f => f.id === fileId) || null;
    if (!found) {
      let products;
      try {
        products = await readProducts();
      } catch (error) {
        sendJson(res, 500, { success: false, message: 'Failed to reach the product database.', error: error.message });
        return;
      }
      for (const product of products) {
        const match = (product.digitalFiles || []).find(f => f && f.id === fileId);
        if (match) { found = match; break; }
      }
    }

    if (found) {
      const content = await supabaseStorageDownload(DIGITAL_BUCKET, found.storedName);
      if (content) {
        serveDownloadBytes(res, content, found.storedName, found.name);
        return;
      }
    }

    sendJson(res, 404, { success: false, message: 'This file is no longer available.' });
    return;
  }

  if (reqPath.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, reqPath.slice('/uploads/'.length));
    if (filePath.startsWith(UPLOADS_DIR)) {
      serveFile(res, filePath);
      return;
    }
  }

  if (reqPath === '/') {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method not allowed');
      return;
    }

    serveFile(res, path.join(ROOT, 'Dwelling Dream Homepage v2.dc.html'));
    return;
  }

  if (reqPath === '/login.html') {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method not allowed');
      return;
    }

    serveFile(res, path.join(ROOT, 'login.html'));
    return;
  }

  if (reqPath === '/admin' || reqPath === '/admin.html') {
    if (!isAuthorized(req)) {
      res.writeHead(302, { Location: '/login.html' });
      res.end();
      return;
    }

    serveFile(res, path.join(ROOT, 'admin.html'));
    return;
  }

  // Clean URLs. The pages are authored as "Dwelling Dream About.dc.html" and
  // similar, which leaked the design-tool filenames - and their %20-encoded
  // spaces - into every public URL. Each page now has a short path, and the
  // old filename 301s to it so existing links and any indexed URLs survive.
  const PAGE_ROUTES = {
    '/about': 'Dwelling Dream About.dc.html',
    '/help': 'Dwelling Dream Help.dc.html',
    '/cart': 'Dwelling Dream Cart.dc.html',
    '/order': 'Dwelling Dream Order.dc.html',
    '/palettes': 'Dwelling Dream Palettes.dc.html',
    '/contact': 'Dwelling Dream Contact.dc.html'
  };
  const LEGACY_PAGE_PATHS = {
    '/Dwelling Dream About.dc.html': '/about',
    '/Dwelling Dream Help.dc.html': '/help',
    '/Dwelling Dream Cart.dc.html': '/cart',
    '/Dwelling Dream Order.dc.html': '/order',
    '/Dwelling Dream Palettes.dc.html': '/palettes',
    '/Dwelling Dream Contact.dc.html': '/contact',
    '/Dwelling Dream Homepage v2.dc.html': '/'
  };

  if (LEGACY_PAGE_PATHS[reqPath] && req.method === 'GET') {
    res.writeHead(301, {
      Location: `${LEGACY_PAGE_PATHS[reqPath]}${url.search}`,
      'Cache-Control': 'public, max-age=3600'
    });
    res.end();
    return;
  }

  if (PAGE_ROUTES[reqPath] && req.method === 'GET') {
    serveFile(res, path.join(ROOT, PAGE_ROUTES[reqPath]));
    return;
  }

  // Product pages live at /palettes/{slug}. /product and the old .dc.html
  // filename still resolve so existing links and indexed URLs survive; both are
  // redirected to the canonical path below rather than serving a duplicate.
  const productPathSlug = reqPath.startsWith('/palettes/')
    ? decodeURIComponent(reqPath.slice('/palettes/'.length))
    : null;
  // 'not_found' means a slug was asked for and matched nothing. That has to
  // answer 404, not 200 with a friendly message - a 200 is a soft 404 and
  // Google will keep the dead URL in the index.
  let productStatus = 'none_specified';

  if (productPathSlug !== null || reqPath === '/product' || reqPath === '/Dwelling Dream Product.dc.html') {
    let htmlText;
    try {
      htmlText = fs.readFileSync(path.join(ROOT, 'Dwelling Dream Product.dc.html'), 'utf-8');
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    try {
      const products = await readProducts();
      const params = new URLSearchParams(url.search);
      if (productPathSlug) params.set('slug', productPathSlug);
      const { product, status } = resolveProductForQuery(params, products);
      productStatus = status;

      // Slugs were shortened (the category prefix was redundant, and one
      // product carried a 132-character keyword-stuffed slug). Old links still
      // resolve, because matchesSlug also accepts the derived category+title
      // form - but serving the same page on two URLs is duplicate content, so
      // anything that is not the canonical slug is redirected to it.
      if (product) {
        // One canonical location per product: /palettes/{canonical-slug}.
        // Anything else - an old slug, /product?slug=, the .dc.html filename -
        // redirects straight here in a single hop, never a chain.
        const canonical = productSlug(product);
        const canonicalPath = `/palettes/${canonical}`;
        const extra = new URLSearchParams(url.search);
        extra.delete('slug');
        extra.delete('id');
        extra.delete('sku');
        const query = extra.toString();
        if (reqPath !== canonicalPath) {
          res.writeHead(301, {
            Location: query ? `${canonicalPath}?${query}` : canonicalPath,
            'Cache-Control': 'public, max-age=3600'
          });
          res.end();
          return;
        }
        htmlText = injectProductMeta(htmlText, product, url.searchParams.get('currency'));
      }
    } catch (error) {
      // Product database unreachable - fall through to the generic
      // template; the client-side fetch will surface the real error.
    }
    serveHtmlText(res, htmlText, productStatus === 'not_found' ? 404 : 200);
    return;
  }

  if (reqPath.endsWith('.html') || reqPath.endsWith('.css') || reqPath.endsWith('.js') || reqPath.endsWith('.svg') || reqPath.endsWith('.png') || reqPath.endsWith('.jpg') || reqPath.endsWith('.jpeg') || reqPath.endsWith('.webp') || reqPath.endsWith('.gif')) {
    const filePath = path.join(ROOT, reqPath.replace(/^\//, ''));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveFile(res, filePath);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

ensureDataFolders();
server.listen(PORT, () => {
  console.log(`Dwelling Dream admin app running at http://localhost:${PORT}`);
  // This line used to print the real password on every start, so the live
  // credential sat in Hostinger's runtime log for anyone with panel access to
  // read. Only the throwaway generated one is worth printing; a configured
  // password is already known to whoever configured it.
  if (ADMIN_PASSWORD_GENERATED) {
    console.log(`Default admin login: username=${ADMIN_USERNAME} password=${ADMIN_PASSWORD}`);
  } else {
    console.log(`Admin login: username=${ADMIN_USERNAME} (password from ADMIN_PASSWORD)`);
  }
});
