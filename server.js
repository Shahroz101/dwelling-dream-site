const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DIGITAL_DIR = path.join(DATA_DIR, 'digital-files');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = crypto.randomBytes(9).toString('hex');
  console.log(`No ADMIN_PASSWORD set - generated one for this run: ${ADMIN_PASSWORD}`);
  console.log('Set ADMIN_USERNAME/ADMIN_PASSWORD env vars to use a fixed login instead.');
}
const sessions = new Map();

const DOWNLOAD_MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.epub': 'application/epub+zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function ensureDataFolders() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(DIGITAL_DIR, { recursive: true });
  if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, '[]', 'utf8');
  }
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, '[]', 'utf8');
  }
}

function readProducts() {
  try {
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    const parsed = JSON.parse(data || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
}

function readOrders() {
  try {
    const data = fs.readFileSync(ORDERS_FILE, 'utf8');
    const parsed = JSON.parse(data || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

function findOrder(orderId, token) {
  const order = readOrders().find(item => String(item.id) === String(orderId));
  if (!order || order.token !== token) return null;
  return order;
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

function saveBase64Image(base64String, sku) {
  if (!base64String || typeof base64String !== 'string') return null;

  const match = base64String.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : mimeType.includes('gif') ? 'gif' : 'jpg';
  const fileId = crypto.randomBytes(8).toString('hex');
  const fileName = `${sku}-${fileId}.${extension}`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const buffer = Buffer.from(match[2], 'base64');
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${fileName}`;
}

function saveBase64File(base64String, originalName, sku) {
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
  fs.writeFileSync(path.join(DIGITAL_DIR, storedName), buffer);

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

function serveDownload(res, filePath, downloadName) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = DOWNLOAD_MIME_TYPES[ext] || 'application/octet-stream';
    const safeName = (downloadName || path.basename(filePath)).replace(/[\r\n"]/g, '');

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${safeName}"`
    });
    res.end(data);
  });
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

function deleteProductById(productId) {
  const products = readProducts();
  const index = products.findIndex(product => String(product.id) === String(productId));
  if (index === -1) return false;

  const [product] = products.splice(index, 1);
  const uploadRoot = path.resolve(UPLOADS_DIR);

  for (const image of product.images || []) {
    if (typeof image !== 'string' || !image.startsWith('/uploads/')) continue;

    const fileName = image.replace(/^\/uploads\//, '');
    const filePath = path.join(uploadRoot, fileName);
    const resolvedFilePath = path.resolve(filePath);

    if (resolvedFilePath.startsWith(uploadRoot) && fs.existsSync(resolvedFilePath)) {
      fs.unlinkSync(resolvedFilePath);
    }
  }

  const digitalRoot = path.resolve(DIGITAL_DIR);
  for (const digitalFile of product.digitalFiles || []) {
    if (!digitalFile || !digitalFile.storedName) continue;
    const resolvedFilePath = path.resolve(path.join(digitalRoot, digitalFile.storedName));
    if (resolvedFilePath.startsWith(digitalRoot) && fs.existsSync(resolvedFilePath)) {
      fs.unlinkSync(resolvedFilePath);
    }
  }

  writeProducts(products);
  return true;
}

function handleApiProducts(req, res) {
  if (req.method === 'GET') {
    // Never expose the internal storedName (the real on-disk filename) for
    // digital files - downloads only ever happen through the token-gated
    // /api/download route.
    const publicProducts = readProducts().map(product => ({
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

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const productId = String(payload.id || '').trim();

        if (!productId) {
          sendJson(res, 400, { success: false, message: 'Product ID is required.' });
          return;
        }

        const deleted = deleteProductById(productId);
        if (!deleted) {
          sendJson(res, 404, { success: false, message: 'Product not found.' });
          return;
        }

        sendJson(res, 200, { success: true, message: 'Product deleted successfully.' });
      } catch (error) {
        sendJson(res, 400, { success: false, message: 'Invalid request body.' });
      }
    });
    return;
  }

  if (req.method === 'PUT') {
    let body = '';

    req.on('data', chunk => { body += chunk; });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const productId = String(payload.id || '').trim();
        if (!productId) {
          sendJson(res, 400, { success: false, message: 'Product ID is required.' });
          return;
        }

        const products = readProducts();
        const index = products.findIndex(item => String(item.id) === productId);
        if (index === -1) {
          sendJson(res, 404, { success: false, message: 'Product not found.' });
          return;
        }

        const existing = products[index];
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
        const uploadRoot = path.resolve(UPLOADS_DIR);
        const digitalRoot = path.resolve(DIGITAL_DIR);

        // Save any newly-uploaded files first, so we know the true final counts
        // before touching anything that's already on disk.
        const savedNewImages = [];
        newImagesRaw.forEach(image => {
          const saved = saveBase64Image(image, sku);
          if (saved) savedNewImages.push(saved);
        });

        const savedNewDigital = [];
        newDigitalRaw.forEach(entry => {
          if (!entry || typeof entry !== 'object') return;
          const saved = saveBase64File(entry.data, entry.name, sku);
          if (saved) savedNewDigital.push(saved);
        });

        const finalImages = (existing.images || []).filter(img => keepImages.includes(img)).concat(savedNewImages);
        const finalDigital = (existing.digitalFiles || [])
          .filter(f => f && keepDigitalIds.has(f.id))
          .concat(savedNewDigital);

        if (!finalImages.length) {
          // Reject the edit without touching the product's existing files - only
          // clean up whatever we just wrote for this rejected attempt.
          savedNewImages.forEach(imagePath => {
            const resolvedFilePath = path.resolve(path.join(uploadRoot, imagePath.replace(/^\/uploads\//, '')));
            if (resolvedFilePath.startsWith(uploadRoot) && fs.existsSync(resolvedFilePath)) {
              fs.unlinkSync(resolvedFilePath);
            }
          });
          savedNewDigital.forEach(digitalFile => {
            const resolvedFilePath = path.resolve(path.join(digitalRoot, digitalFile.storedName));
            if (resolvedFilePath.startsWith(digitalRoot) && fs.existsSync(resolvedFilePath)) {
              fs.unlinkSync(resolvedFilePath);
            }
          });
          sendJson(res, 400, { success: false, message: 'At least one product image is required.' });
          return;
        }

        // Validation passed - now it's safe to remove whatever was dropped from the "keep" lists.
        (existing.images || []).forEach(imagePath => {
          if (keepImages.includes(imagePath)) return;
          if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) return;
          const resolvedFilePath = path.resolve(path.join(uploadRoot, imagePath.replace(/^\/uploads\//, '')));
          if (resolvedFilePath.startsWith(uploadRoot) && fs.existsSync(resolvedFilePath)) {
            fs.unlinkSync(resolvedFilePath);
          }
        });

        (existing.digitalFiles || []).forEach(digitalFile => {
          if (!digitalFile || keepDigitalIds.has(digitalFile.id)) return;
          if (!digitalFile.storedName) return;
          const resolvedFilePath = path.resolve(path.join(digitalRoot, digitalFile.storedName));
          if (resolvedFilePath.startsWith(digitalRoot) && fs.existsSync(resolvedFilePath)) {
            fs.unlinkSync(resolvedFilePath);
          }
        });

        const updatedProduct = {
          ...existing,
          title,
          description,
          category,
          price,
          images: finalImages,
          digitalFiles: finalDigital,
          updatedAt: new Date().toISOString()
        };
        products[index] = updatedProduct;
        writeProducts(products);

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

    req.on('end', () => {
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
        images.forEach((image) => {
          const savedLink = saveBase64Image(image, sku);
          if (savedLink) savedImages.push(savedLink);
        });

        const savedDigitalFiles = [];
        digitalFilesRaw.forEach(entry => {
          if (!entry || typeof entry !== 'object') return;
          const saved = saveBase64File(entry.data, entry.name, sku);
          if (saved) savedDigitalFiles.push(saved);
        });

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

        const products = readProducts();
        products.unshift(product);
        writeProducts(products);

        sendJson(res, 201, { success: true, message: 'Product saved successfully.', product });
      } catch (error) {
        sendJson(res, 500, { success: false, message: 'Failed to store product.', error: error.message });
      }
    });
    return;
  }

  sendJson(res, 405, { success: false, message: 'Method not allowed.' });
}

function handleApiOrders(req, res) {
  // Public checkout endpoint - no admin auth required.
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed.' });
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}');
      const requestedItems = Array.isArray(payload.items) ? payload.items : [];
      const productsById = new Map(readProducts().map(product => [String(product.id), product]));

      const orderItems = [];
      let total = 0;
      requestedItems.forEach(entry => {
        if (!entry || typeof entry !== 'object') return;
        const product = productsById.get(String(entry.id));
        if (!product) return;
        const qty = Math.max(1, parseInt(entry.qty, 10) || 1);
        const price = Number(product.price || 0);
        total += price * qty;
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
      });

      if (!orderItems.length) {
        sendJson(res, 400, { success: false, message: 'No valid items to check out.' });
        return;
      }

      const order = {
        id: crypto.randomBytes(8).toString('hex'),
        token: crypto.randomBytes(24).toString('hex'),
        items: orderItems,
        total: Math.round(total * 100) / 100,
        // STUB: no payment processor is wired in yet, so every order is marked
        // paid immediately. Swap this for a real Stripe/Lemon Squeezy webhook
        // that flips `paid` to true only once the charge actually succeeds.
        paid: true,
        createdAt: new Date().toISOString()
      };

      const orders = readOrders();
      orders.unshift(order);
      writeOrders(orders);

      sendJson(res, 201, { success: true, order });
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

const server = http.createServer((req, res) => {
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

  if (reqPath === '/api/products') {
    handleApiProducts(req, res);
    return;
  }

  if (reqPath === '/api/orders') {
    handleApiOrders(req, res);
    return;
  }

  if (reqPath.startsWith('/api/orders/') && req.method === 'GET') {
    const orderId = reqPath.slice('/api/orders/'.length);
    const token = url.searchParams.get('token') || '';
    const order = findOrder(orderId, token);
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

    const order = findOrder(orderId, token);
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

    const digitalRoot = path.resolve(DIGITAL_DIR);
    let found = null;
    for (const product of readProducts()) {
      const match = (product.digitalFiles || []).find(f => f && f.id === fileId);
      if (match) { found = match; break; }
    }

    if (found) {
      const target = path.resolve(path.join(digitalRoot, found.storedName));
      if (target.startsWith(digitalRoot) && fs.existsSync(target)) {
        serveDownload(res, target, found.name);
        return;
      }
    }

    sendJson(res, 404, { success: false, message: 'This file is no longer available.' });
    return;
  }

  if (reqPath.startsWith('/uploads/')) {
    const filePath = path.join(ROOT, reqPath.replace(/^\//, ''));
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
