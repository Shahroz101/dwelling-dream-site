/* ========================================================================== *
 * Dwelling Dream — cart store, WooCommerce edition
 *
 * Same exports as the storefront's original cart.js (which kept the cart in
 * localStorage), now backed by the WooCommerce Store API so the cart the
 * header badge shows is the cart checkout charges for. Reads are served from
 * an in-memory copy of the last server response; every mutation talks to the
 * server and then broadcasts the fresh cart on `dd:cart-change`.
 * ========================================================================== */

const API = '/wp-json/wc/store/v1';
const EVENT = 'dd:cart-change';

let nonce = null;
let cart = null;          // last Store API cart response
let loading = null;       // in-flight refresh(), so callers share one request

function minorUnits(cartData) {
  const totals = (cartData && cartData.totals) || {};
  return Number(totals.currency_minor_unit != null ? totals.currency_minor_unit : 2);
}

function money(value, cartData) {
  return Number(value || 0) / Math.pow(10, minorUnits(cartData));
}

function normalizeItem(item, cartData) {
  const image = Array.isArray(item.images) && item.images[0] ? (item.images[0].src || item.images[0].thumbnail) : '';
  return {
    key: item.key,
    id: item.id,
    sku: item.sku || '',
    title: item.name || 'Palette',
    brand: '',
    price: money(item.prices && item.prices.price, cartData),
    lineTotal: money(item.totals && item.totals.line_total, cartData),
    image,
    qty: Number(item.quantity || 0),
    permalink: item.permalink || ''
  };
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (nonce) headers.Nonce = nonce;
  const response = await fetch(API + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const fresh = response.headers.get('Nonce');
  if (fresh) nonce = fresh;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'The cart could not be updated.');
    error.code = data.code;
    throw error;
  }
  return data;
}

function broadcast() {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: getCart() }));
}

function commit(cartData) {
  cart = cartData;
  broadcast();
  return getCart();
}

// Mutations need a nonce, which any prior Store API response supplies.
async function ensureNonce() {
  if (!nonce) await refresh();
}

/** Fetches the cart from the server. Resolves to the normalised items. */
export function refresh() {
  if (!loading) {
    loading = request('/cart')
      .then(data => commit(data))
      .finally(() => { loading = null; });
  }
  return loading;
}

/** Whether the cart has been fetched at least once this page load. */
export function isLoaded() {
  return cart !== null;
}

export function getCart() {
  if (!cart || !Array.isArray(cart.items)) return [];
  return cart.items.map(item => normalizeItem(item, cart));
}

export function getCount() {
  return cart ? Number(cart.items_count || 0) : 0;
}

export function getSubtotal() {
  return cart ? money(cart.totals.total_items, cart) : 0;
}

export function getDiscount() {
  return cart ? money(cart.totals.total_discount, cart) : 0;
}

export function getTotal() {
  return cart ? money(cart.totals.total_price, cart) : 0;
}

export function getCoupons() {
  return cart && Array.isArray(cart.coupons) ? cart.coupons.map(c => c.code) : [];
}

export async function addItem(product, qty = 1) {
  await ensureNonce();
  const id = Number(product && product.id);
  if (!id) return getCart();
  return commit(await request('/cart/add-item', { method: 'POST', body: { id, quantity: qty } }));
}

export async function setQty(key, qty) {
  await ensureNonce();
  if (qty <= 0) return removeItem(key);
  return commit(await request('/cart/update-item', { method: 'POST', body: { key, quantity: qty } }));
}

export async function removeItem(key) {
  await ensureNonce();
  return commit(await request('/cart/remove-item', { method: 'POST', body: { key } }));
}

export async function clearCart() {
  await ensureNonce();
  return commit(await request('/cart/items', { method: 'DELETE' }));
}

export async function applyCoupon(code) {
  await ensureNonce();
  return commit(await request('/cart/apply-coupon', { method: 'POST', body: { code } }));
}

export async function removeCoupon(code) {
  await ensureNonce();
  return commit(await request('/cart/remove-coupon', { method: 'POST', body: { code } }));
}

export function onCartChange(callback) {
  const handler = event => callback(event.detail || getCart());
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/**
 * Keeps the header's [data-cart-count] badge in step with the cart. The badge
 * is server-rendered, so it already shows the right number; this only writes
 * once the live cart is known, and animates when the count goes up.
 */
export function syncCartBadge(root = document) {
  const badge = root.querySelector('[data-cart-count]');
  const button = root.querySelector('[data-cart]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let previous = badge ? Number(badge.textContent) || 0 : 0;

  const update = () => {
    if (!isLoaded()) return;
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
  refresh().then(update).catch(() => {});
  return onCartChange(update);
}
