/* ========================================================================== *
 * Dwelling Dream — shared cart store
 * localStorage-backed so "Add to cart" on the Product page actually shows up
 * on the Cart page, and the header badge stays correct across navigations.
 * Framework-agnostic: swap for real commerce state (Stripe/Shopify/etc.) by
 * reimplementing these same exports.
 * ========================================================================== */

const STORAGE_KEY = 'dwellingDreamCart';
const EVENT = 'dd:cart-change';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function write(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: items }));
  return items;
}

export function getCart() {
  return read();
}

export function addItem(product, qty = 1) {
  const id = String(product.id || product.sku || product.title || '');
  if (!id) return read();

  const items = read();
  const existing = items.find(item => item.id === id);
  if (existing) {
    existing.qty += qty;
  } else {
    items.push({
      id,
      sku: product.sku || '',
      title: product.title || 'Palette',
      brand: product.brand || product.category || '',
      price: Number(product.price || 0),
      image: product.image || (Array.isArray(product.images) ? product.images[0] : '') || '',
      qty
    });
  }
  return write(items);
}

export function setQty(id, qty) {
  const items = read();
  const next = qty <= 0
    ? items.filter(item => item.id !== id)
    : items.map(item => (item.id === id ? { ...item, qty } : item));
  return write(next);
}

export function removeItem(id) {
  return setQty(id, 0);
}

export function clearCart() {
  return write([]);
}

export function getCount() {
  return read().reduce((sum, item) => sum + item.qty, 0);
}

export function getSubtotal() {
  return read().reduce((sum, item) => sum + item.qty * item.price, 0);
}

export function onCartChange(callback) {
  const handler = event => callback(event.detail || read());
  const storageHandler = event => { if (event.key === STORAGE_KEY) callback(read()); };
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
}

/**
 * Wires the standard [data-cart] / [data-cart-count] header markup to reflect
 * the real stored cart count, and keeps it live as items are added/removed.
 */
export function syncCartBadge(root = document) {
  const badge = root.querySelector('[data-cart-count]');
  const button = root.querySelector('[data-cart]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let previous = getCount();

  const update = () => {
    const n = getCount();
    if (badge) badge.textContent = String(n);
    if (button) button.setAttribute('aria-label', `Cart, ${n} ${n === 1 ? 'item' : 'items'}`);
    if (badge && !reduced && n > previous) {
      badge.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }, { transform: 'scale(1)' }],
        { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' }
      );
    }
    previous = n;
  };
  update();
  return onCartChange(update);
}
