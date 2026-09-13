#!/usr/bin/env node
// Copies the catalogue from Supabase into WooCommerce.
//
//   node scripts/import-to-woocommerce.js            # every product
//   node scripts/import-to-woocommerce.js SHER-RETR-1450   # one SKU
//   DRY_RUN=1 node scripts/import-to-woocommerce.js  # report only
//
// Idempotent: products are matched by SKU and updated in place, so it can be
// re-run after edits in Supabase. For each product it
//   - ensures the brand exists as a product category,
//   - uploads the digital files into wp-content/uploads/woocommerce_uploads/
//     (the folder WooCommerce protects; downloads are then served through
//     its own token-gated links),
//   - creates/updates the product with the same slug, title, description,
//     price, SKU and images, as a virtual downloadable product.
//
// Needs in .env: SUPABASE_URL, SUPABASE_SERVICE_KEY, WP_APP_PASSWORD.
// Needs in the environment: WP_SITE (e.g. https://wp.dwellingdream.shop),
// and for the file uploads HOSTINGER_UPLOAD_URL, HOSTINGER_AUTH_KEY,
// HOSTINGER_REST_KEY (from Hostinger's "generate upload URL" API).

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const WP_SITE = (process.env.WP_SITE || 'https://wp.dwellingdream.shop').replace(/\/$/, '');
const WP_USER = process.env.WP_USER || 'dwelling_admin';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || '';
const UPLOAD_URL = process.env.HOSTINGER_UPLOAD_URL || '';
const UPLOAD_AUTH = process.env.HOSTINGER_AUTH_KEY || '';
const UPLOAD_REST = process.env.HOSTINGER_REST_KEY || '';
const DRY_RUN = !!process.env.DRY_RUN;
const ONLY_SKU = process.argv[2] || null;

// Product images are served from the storefront's own domain (CDN-cached)
// rather than straight from Supabase Storage, which rate-limits bursts.
const IMAGE_ORIGIN = 'https://dwellingdream.shop/product-image/';
const DOWNLOADS_DIR = 'wp-content/uploads/woocommerce_uploads/dd';

for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_KEY, WP_APP_PASSWORD })) {
  if (!value) { console.error(`Missing ${name}`); process.exit(1); }
}

const wpAuth = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Creating a product makes WooCommerce sideload every image, which on shared
// hosting can take minutes; reads that time out are retried, writes are not
// (a retried create would duplicate the product).
async function wc(method, route, body, { attempts = method === 'GET' ? 3 : 1 } = {}) {
  let res;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(`${WP_SITE}/wp-json${route}`, {
        method,
        headers: { Authorization: wpAuth, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(method === 'GET' ? 60000 : 600000)
      });
      if (res.status >= 500 && attempt < attempts) { await sleep(15000 * attempt); continue; }
      break;
    } catch (error) {
      if (attempt >= attempts) throw error;
      await sleep(15000 * attempt);
    }
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function loadProducts() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function ensureCategories(names) {
  const existing = await wc('GET', '/wc/v3/products/categories?per_page=100');
  const byName = new Map(existing.map(c => [c.name.toLowerCase(), c.id]));
  for (const name of names) {
    if (byName.has(name.toLowerCase())) continue;
    if (DRY_RUN) { console.log(`  would create category "${name}"`); continue; }
    const created = await wc('POST', '/wc/v3/products/categories', { name });
    byName.set(name.toLowerCase(), created.id);
    console.log(`  created category "${name}" (#${created.id})`);
  }
  return byName;
}

// Supabase Storage -> local temp file -> Hostinger (TUS). Skipped when the
// file is already on the server with the same size.
async function uploadDigitalFile(file) {
  const remotePath = `${DOWNLOADS_DIR}/${file.storedName}`;
  const publicUrl = `${WP_SITE}/${remotePath}`;
  if (!UPLOAD_URL) return { url: publicUrl, skipped: 'no upload credentials' };

  const head = await fetch(`${UPLOAD_URL}/${remotePath}`, {
    method: 'HEAD',
    headers: { 'X-Auth': UPLOAD_AUTH, 'X-Auth-Rest': UPLOAD_REST, 'Tus-Resumable': '1.0.0' },
    signal: AbortSignal.timeout(30000)
  }).catch(() => null);
  if (head && head.ok) {
    const length = Number(head.headers.get('Upload-Length') || head.headers.get('Content-Length') || 0);
    if (length && length === Number(file.size)) return { url: publicUrl, skipped: 'already uploaded' };
  }
  if (DRY_RUN) return { url: publicUrl, skipped: 'dry run' };

  const src = await fetch(`${SUPABASE_URL}/storage/v1/object/digital-files/${encodeURIComponent(file.storedName)}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!src.ok) throw new Error(`download ${file.storedName}: ${src.status}`);
  const bytes = Buffer.from(await src.arrayBuffer());

  const common = { 'X-Auth': UPLOAD_AUTH, 'X-Auth-Rest': UPLOAD_REST, 'Tus-Resumable': '1.0.0' };
  const create = await fetch(`${UPLOAD_URL}/${remotePath}?override=true`, {
    method: 'POST', headers: { ...common, 'Upload-Length': String(bytes.length), 'Upload-Offset': '0' },
    signal: AbortSignal.timeout(60000)
  });
  if (create.status !== 201) throw new Error(`upload create ${file.storedName}: ${create.status}`);
  const patch = await fetch(`${UPLOAD_URL}/${remotePath}?override=true`, {
    method: 'PATCH',
    headers: { ...common, 'Content-Type': 'application/offset+octet-stream', 'Upload-Offset': '0' },
    body: bytes,
    signal: AbortSignal.timeout(300000)
  });
  if (patch.status !== 204) throw new Error(`upload ${file.storedName}: ${patch.status}`);
  return { url: publicUrl, uploaded: bytes.length };
}

function imageSources(product) {
  return (product.images || []).map(url => {
    const name = String(url).split('/').pop();
    return { src: IMAGE_ORIGIN + name, name };
  });
}

// WooCommerce wants site-local time without an offset.
function localDate(iso) {
  return iso ? iso.replace(/\.\d+/, '').replace(/[+Z].*$/, '') : undefined;
}

async function upsertProduct(product, categoryIds) {
  const brand = product.category || '';
  const description = product.description || '';

  const downloads = [];
  for (const file of product.digital_files || []) {
    if (!file || !file.storedName) continue;
    const result = await uploadDigitalFile(file);
    downloads.push({ name: file.name || file.storedName, file: result.url });
    console.log(`    file ${file.name}: ${result.skipped || `uploaded ${(result.uploaded / 1048576).toFixed(1)} MB`}`);
  }

  const payload = {
    name: product.title,
    slug: product.slug || undefined,
    sku: product.sku,
    type: 'simple',
    status: product.active === false ? 'draft' : 'publish',
    regular_price: String(product.price),
    virtual: true,
    downloadable: true,
    downloads,
    download_limit: -1,
    download_expiry: -1,
    manage_stock: false,
    stock_status: 'instock',
    short_description: description,
    description,
    categories: categoryIds.has(brand.toLowerCase()) ? [{ id: categoryIds.get(brand.toLowerCase()) }] : [],
    date_created: localDate(product.created_at),
    meta_data: [
      { key: '_dd_supabase_id', value: product.id },
      { key: '_dd_price_gbp', value: product.price_gbp == null ? '' : String(product.price_gbp) }
    ]
  };

  const existing = await wc('GET', `/wc/v3/products?sku=${encodeURIComponent(product.sku)}&status=any`);
  const current = existing[0];

  // Images only on create, or when the set changed - WooCommerce sideloads
  // every URL it is given, and ten images per product adds up.
  const wanted = imageSources(product);
  const currentNames = current ? current.images.map(i => (i.name || i.src.split('/').pop()).replace(/\.[a-z]+$/i, '')) : [];
  const wantedNames = wanted.map(i => i.name.replace(/\.[a-z]+$/i, ''));
  const imagesChanged = !current || currentNames.length !== wantedNames.length || wantedNames.some((n, i) => !currentNames[i] || !currentNames[i].startsWith(n));
  if (imagesChanged) payload.images = wanted;

  if (DRY_RUN) {
    console.log(`  ${current ? 'would update' : 'would create'} ${product.sku} "${product.title}" (${wanted.length} images, ${downloads.length} files)`);
    return;
  }
  const saved = current
    ? await wc('PUT', `/wc/v3/products/${current.id}`, payload)
    : await wc('POST', '/wc/v3/products', payload);
  console.log(`  ${current ? 'updated' : 'created'} #${saved.id} ${product.sku} "${saved.name}" -> ${saved.permalink} (${saved.images.length} images)`);
}

(async () => {
  const products = (await loadProducts()).filter(p => !ONLY_SKU || p.sku === ONLY_SKU);
  console.log(`${products.length} product(s) from Supabase${DRY_RUN ? ' (dry run)' : ''}`);
  const brands = [...new Set(products.map(p => p.category).filter(Boolean))];
  const categoryIds = await ensureCategories(brands);

  let failed = 0;
  for (const product of products) {
    console.log(`\n${product.sku} — ${product.title}`);
    try {
      await upsertProduct(product, categoryIds);
    } catch (error) {
      failed++;
      console.error(`  FAILED: ${error.message}`);
    }
    // Let the host's PHP workers finish resizing before the next batch.
    if (!DRY_RUN) await sleep(Number(process.env.PAUSE_MS || 20000));
  }
  console.log(`\nDone. ${products.length - failed} ok, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
