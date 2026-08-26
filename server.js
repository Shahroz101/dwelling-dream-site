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

// PayPal is intentionally allowed to be unconfigured - the rest of the site
// (catalog, admin, existing orders) must keep working even if these are
// missing. Routes that need PayPal check paypalConfigured() themselves and
// fail with a clear 500 instead of crashing the whole server at startup.
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_ENVIRONMENT = (process.env.PAYPAL_ENVIRONMENT || 'sandbox').trim().toLowerCase();
const PAYPAL_API_BASE = PAYPAL_ENVIRONMENT === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';
const ORDER_CURRENCY = 'EUR';
let paypalTokenCache = { token: null, expiresAt: 0 };

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

function paypalConfigured() {
  return Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
}

async function getPaypalAccessToken() {
  const now = Date.now();
  if (paypalTokenCache.token && paypalTokenCache.expiresAt > now + 30000) {
    return paypalTokenCache.token;
  }

  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`PayPal OAuth failed: ${res.status} ${JSON.stringify(data)}`);
  }

  paypalTokenCache = {
    token: data.access_token,
    expiresAt: now + (Number(data.expires_in) || 300) * 1000
  };
  return paypalTokenCache.token;
}

// Returns [httpStatus, parsedJsonBody]. Never throws on a PayPal-side error
// response - callers check the status themselves, since a failed capture is
// an expected, handled case, not a server bug.
async function paypalRequest(path, { method = 'GET', body } = {}) {
  const token = await getPaypalAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      parsed = { raw: text };
    }
  }
  return [res.status, parsed];
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
    title: row.title,
    description: row.description,
    category: row.category,
    price: Number(row.price),
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

async function getProductById(productId) {
  const rows = (await supabaseRequest(`products?id=eq.${encodeURIComponent(productId)}&select=*`)) || [];
  return rows[0] ? rowToProduct(rows[0]) : null;
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
    paypalOrderId: row.paypal_order_id || null,
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
    paypal_order_id: order.paypalOrderId || null,
    customer_email: order.customerEmail || null,
    created_at: order.createdAt,
    updated_at: order.updatedAt || order.createdAt
  };
  const rows = await supabaseRequest('orders', { method: 'POST', body: row });
  return rowToOrder(rows[0]);
}

async function findOrderByPaypalId(paypalOrderId) {
  const rows = (await supabaseRequest(`orders?paypal_order_id=eq.${encodeURIComponent(paypalOrderId)}&select=*`)) || [];
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

async function saveBase64Image(base64String, sku) {
  if (!base64String || typeof base64String !== 'string') return null;

  const match = base64String.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : mimeType.includes('gif') ? 'gif' : 'jpg';
  const fileId = crypto.randomBytes(8).toString('hex');
  const fileName = `${sku}-${fileId}.${extension}`;
  const buffer = Buffer.from(match[2], 'base64');
  await supabaseStorageUpload(IMAGES_BUCKET, fileName, buffer, mimeType);
  return supabasePublicUrl(IMAGES_BUCKET, fileName);
}

async function saveBase64File(base64String, originalName, sku) {
  if (!base64String || typeof base64String !== 'string') return null;

  const match = base64String.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  let ext = '';
  if (originalName && originalName.includes('.')) {
    ext = '.' + originalName.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  if (!ext) {
    ext = { 'application/pdf': '.pdf', 'application/zip': '.zip', 'application/epub+zip': '.epub' }[mimeType] || '.bin';
  }

  const buffer = Buffer.from(match[2], 'base64');
  const fileId = crypto.randomBytes(8).toString('hex');
  const storedName = `${sku}-${fileId}${ext}`;
  await supabaseStorageUpload(DIGITAL_BUCKET, storedName, buffer, mimeType);

  return {
    id: fileId,
    name: (originalName || storedName).trim() || storedName,
    size: buffer.length,
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
          const saved = await saveBase64Image(image, sku);
          if (saved) savedNewImages.push(saved);
        }

        const savedNewDigital = [];
        for (const entry of newDigitalRaw) {
          if (!entry || typeof entry !== 'object') continue;
          const saved = await saveBase64File(entry.data, entry.name, sku);
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
          await updateProduct(productId, {
            title,
            description,
            category,
            price,
            images: finalImages,
            digital_files: finalDigital,
            updated_at: updatedAt
          });
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
          const savedLink = await saveBase64Image(image, sku);
          if (savedLink) savedImages.push(savedLink);
        }

        const savedDigitalFiles = [];
        for (const entry of digitalFilesRaw) {
          if (!entry || typeof entry !== 'object') continue;
          const saved = await saveBase64File(entry.data, entry.name, sku);
          if (saved) savedDigitalFiles.push(saved);
        }

        const product = {
          id: crypto.randomUUID(),
          sku,
          title,
          description,
          price,
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

function handleCreatePaypalOrder(req, res) {
  // Public checkout endpoint - no admin auth required. The browser only
  // ever tells us WHICH products/quantities are wanted; every price used
  // below comes from Supabase, never from the request.
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed.' });
    return;
  }
  if (!paypalConfigured()) {
    sendJson(res, 500, { success: false, message: 'PayPal is not configured on the server.' });
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
        if ((product.currency || ORDER_CURRENCY) !== ORDER_CURRENCY) {
          sendJson(res, 400, { success: false, message: 'Unsupported product currency.' });
          return;
        }

        const qty = Math.max(1, Math.min(20, parseInt(entry.qty, 10) || 1));
        const price = Number(product.price || 0);
        const priceCents = Math.round(price * 100);
        totalCents += priceCents * qty;
        orderItems.push({
          productId: product.id,
          sku: product.sku || '',
          title: product.title || 'Product',
          price,
          qty,
          digitalFiles: (product.digitalFiles || [])
            .filter(f => f && typeof f === 'object')
            .map(f => ({ id: f.id, name: f.name, size: f.size || 0 }))
        });
      }

      if (!orderItems.length || totalCents <= 0) {
        sendJson(res, 400, { success: false, message: 'No valid items to check out.' });
        return;
      }

      const total = totalCents / 100;

      let paypalStatus;
      let paypalOrder;
      try {
        [paypalStatus, paypalOrder] = await paypalRequest('/v2/checkout/orders', {
          method: 'POST',
          body: {
            intent: 'CAPTURE',
            purchase_units: [{
              amount: { currency_code: ORDER_CURRENCY, value: total.toFixed(2) }
            }]
          }
        });
      } catch (error) {
        sendJson(res, 502, { success: false, message: 'Failed to reach PayPal.', error: error.message });
        return;
      }

      if (![200, 201].includes(paypalStatus) || !paypalOrder.id) {
        sendJson(res, 502, { success: false, message: 'Failed to create PayPal order.', error: paypalOrder });
        return;
      }

      const order = {
        id: crypto.randomBytes(8).toString('hex'),
        token: crypto.randomBytes(24).toString('hex'),
        paypalOrderId: paypalOrder.id,
        items: orderItems,
        total,
        currency: ORDER_CURRENCY,
        status: 'PENDING',
        paid: false,
        createdAt: new Date().toISOString()
      };

      try {
        await insertOrder(order);
      } catch (error) {
        sendJson(res, 500, { success: false, message: 'Failed to save order.', error: error.message });
        return;
      }

      sendJson(res, 201, {
        success: true,
        paypalOrderId: paypalOrder.id,
        orderId: order.id,
        token: order.token
      });
    } catch (error) {
      sendJson(res, 400, { success: false, message: 'Invalid request body.' });
    }
  });
}

function handleCapturePaypalOrder(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed.' });
    return;
  }
  if (!paypalConfigured()) {
    sendJson(res, 500, { success: false, message: 'PayPal is not configured on the server.' });
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const paypalOrderId = String(payload.paypalOrderId || '').trim();
      if (!paypalOrderId) {
        sendJson(res, 400, { success: false, message: 'paypalOrderId is required.' });
        return;
      }

      let existingOrder;
      try {
        existingOrder = await findOrderByPaypalId(paypalOrderId);
      } catch (error) {
        sendJson(res, 500, { success: false, message: 'Failed to reach the order database.', error: error.message });
        return;
      }

      if (!existingOrder) {
        sendJson(res, 404, { success: false, message: 'Order not found.' });
        return;
      }

      // Idempotency: a repeated capture request for an order that's already
      // COMPLETED must not process the payment twice or return an error -
      // just hand back the same success result.
      if (existingOrder.status === 'COMPLETED') {
        sendJson(res, 200, {
          success: true,
          orderId: existingOrder.id,
          token: existingOrder.token,
          alreadyCaptured: true
        });
        return;
      }

      let captureStatus;
      let capture;
      try {
        [captureStatus, capture] = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, { method: 'POST', body: {} });
      } catch (error) {
        sendJson(res, 502, { success: false, message: 'Failed to reach PayPal.', error: error.message });
        return;
      }

      if (![200, 201].includes(captureStatus) || capture.status !== 'COMPLETED') {
        try { await updateOrderStatus(existingOrder.id, 'FAILED'); } catch (error) { /* best effort */ }
        sendJson(res, 402, { success: false, message: 'Payment was not completed.', error: capture });
        return;
      }

      let capturedAmount;
      let capturedCurrency;
      try {
        const captured = capture.purchase_units[0].payments.captures[0];
        capturedAmount = Number(captured.amount.value);
        capturedCurrency = captured.amount.currency_code;
      } catch (error) {
        sendJson(res, 502, { success: false, message: 'Unexpected response from PayPal.' });
        return;
      }

      const expectedCents = Math.round(existingOrder.total * 100);
      const capturedCents = Math.round(capturedAmount * 100);

      if (capturedCents !== expectedCents || capturedCurrency !== (existingOrder.currency || ORDER_CURRENCY)) {
        try { await updateOrderStatus(existingOrder.id, 'FAILED'); } catch (error) { /* best effort */ }
        sendJson(res, 402, { success: false, message: 'Payment amount did not match the order.' });
        return;
      }

      const payerEmail = capture.payer && capture.payer.email_address ? capture.payer.email_address : null;

      try {
        await markOrderPaid(existingOrder.id, payerEmail);
      } catch (error) {
        sendJson(res, 500, { success: false, message: 'Payment succeeded but saving the order failed.', error: error.message });
        return;
      }

      sendJson(res, 200, {
        success: true,
        orderId: existingOrder.id,
        token: existingOrder.token
      });
    } catch (error) {
      sendJson(res, 400, { success: false, message: 'Invalid request body.' });
    }
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
  // Decode %20 etc. so routes/filenames with spaces (all the "Dwelling Dream
  // *.dc.html" pages) match, mirroring server.py's unquote(url.path).
  const reqPath = decodeURIComponent(url.pathname);

  if (reqPath === '/api/login' && req.method === 'POST') {
    handleApiLogin(req, res);
    return;
  }

  if (reqPath === '/api/logout' && req.method === 'POST') {
    handleLogout(req, res);
    return;
  }

  if (reqPath === '/api/config' && req.method === 'GET') {
    // Public, non-secret runtime config the frontend needs - the PayPal
    // Client ID is designed to be public (PayPal's own SDK requires it in
    // the browser). PAYPAL_CLIENT_SECRET never appears here or anywhere
    // else reachable from a GET/POST response.
    sendJson(res, 200, {
      paypalClientId: PAYPAL_CLIENT_ID,
      paypalEnvironment: PAYPAL_ENVIRONMENT,
      currency: ORDER_CURRENCY
    });
    return;
  }

  if (reqPath === '/api/products') {
    await handleApiProducts(req, res);
    return;
  }

  if (reqPath === '/api/paypal/create-order') {
    await handleCreatePaypalOrder(req, res);
    return;
  }

  if (reqPath === '/api/paypal/capture-order') {
    await handleCapturePaypalOrder(req, res);
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

    let products;
    try {
      products = await readProducts();
    } catch (error) {
      sendJson(res, 500, { success: false, message: 'Failed to reach the product database.', error: error.message });
      return;
    }
    let found = null;
    for (const product of products) {
      const match = (product.digitalFiles || []).find(f => f && f.id === fileId);
      if (match) { found = match; break; }
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

  if (reqPath === '/palettes' || reqPath === '/Dwelling Dream Palettes.dc.html') {
    serveFile(res, path.join(ROOT, 'Dwelling Dream Palettes.dc.html'));
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
  console.log(`Default admin login: username=admin password=${ADMIN_PASSWORD}`);
});
