// Payments, over Stripe Checkout.
//
// The buyer is redirected to a Stripe-hosted payment page and returned to the
// order page afterwards. Card details never reach this server, which keeps the
// store in the narrowest PCI scope, and Apple Pay, Google Pay and Link come
// along without any extra work.
//
// Three rules, learned from the mail module and from what this codebase has
// already been bitten by:
//
// 1. The dependency is loaded defensively. A bare require would run at startup,
//    so a build landing without node_modules would throw before the process
//    binds a port and take the whole storefront down with a 503 - catalog,
//    admin, existing downloads and all - over a payment library. Payments are
//    worth less than the shop.
//
// 2. Nothing here throws. Every function resolves to a result object the caller
//    inspects, so a Stripe outage produces a clear message rather than a stack
//    trace in the middle of checkout.
//
// 3. Amounts are never taken from the browser. The caller builds the order from
//    Supabase prices and passes it in; this module only converts that to
//    Stripe's shape.

let Stripe = null;
try {
  Stripe = require('stripe');
} catch (error) {
  console.error('[payments] stripe is not installed - checkout is disabled:', error.message);
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

let client = null;

function isConfigured() {
  return Boolean(Stripe && STRIPE_SECRET_KEY);
}

// True when the keys are Stripe's test keys rather than live ones. Surfaced so
// the storefront can say so out loud: the PayPal integration sat in sandbox for
// an unknown length of time while looking entirely operational, and no real
// customer could pay.
function isTestMode() {
  return /^sk_test_/.test(STRIPE_SECRET_KEY);
}

function webhookConfigured() {
  return Boolean(STRIPE_WEBHOOK_SECRET);
}

function stripe() {
  if (!isConfigured()) return null;
  if (!client) {
    client = new Stripe(STRIPE_SECRET_KEY, {
      // Pinned deliberately. Stripe ships breaking API changes behind dated
      // versions, and an unpinned client silently follows whatever the account
      // default becomes.
      apiVersion: '2025-08-27.basil',
      maxNetworkRetries: 2,
      timeout: 20000
    });
  }
  return client;
}

// Free line items (the bundled guides) are omitted rather than sent at zero:
// they add nothing to the total, and a zero-amount line is a needless edge case
// in Stripe's totals. They still travel on the order row and in the emails.
function lineItems(order) {
  return (order.items || [])
    .filter(item => Number(item.price) > 0)
    .map(item => ({
      quantity: Math.max(1, Number(item.qty) || 1),
      price_data: {
        currency: String(order.currency || 'USD').toLowerCase(),
        unit_amount: Math.round(Number(item.price) * 100),
        product_data: {
          name: item.title || 'Dwelling Dream palette',
          // Stripe fetches these itself and renders them on the payment page,
          // so they must be publicly reachable absolute URLs - it cannot see
          // anything behind auth. Capped at Stripe's limit of 8.
          ...(item.image ? { images: [item.image].slice(0, 8) } : {}),
          ...(item.description ? { description: item.description } : {}),
          ...(item.sku ? { metadata: { sku: item.sku } } : {})
        }
      }
    }));
}

// Resolves { ok: true, id, url } or { ok: false, error }. Never rejects.
async function createCheckoutSession({ order, successUrl, cancelUrl }) {
  const api = stripe();
  if (!api) return { ok: false, error: 'Stripe is not configured.' };

  const items = lineItems(order);
  if (!items.length) return { ok: false, error: 'This order has nothing payable in it.' };

  try {
    const session = await api.checkout.sessions.create({
      mode: 'payment',
      line_items: items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      // client_reference_id and metadata both carry the order id so the webhook
      // can find the row again. The token rides in metadata only - it is the
      // download credential and has no business in a URL Stripe might log.
      client_reference_id: order.id,
      metadata: { orderId: order.id, orderToken: order.token },
      // Digital goods: nothing is shipped, so no address is collected.
      billing_address_collection: 'auto',
      // Stripe collects the buyer's email on its own page; that address is what
      // the receipt and the download link are sent to.
      customer_creation: 'if_required'
    });
    return { ok: true, id: session.id, url: session.url };
  } catch (error) {
    console.error('[payments] could not create a checkout session:', error.message);
    return { ok: false, error: error.message };
  }
}

// Reads a session back from Stripe. Used to reconcile an order whose webhook
// never arrived - see the /api/orders handler.
async function retrieveSession(sessionId) {
  const api = stripe();
  if (!api) return { ok: false, error: 'Stripe is not configured.' };
  try {
    const session = await api.checkout.sessions.retrieve(sessionId);
    return {
      ok: true,
      paid: session.payment_status === 'paid',
      email: (session.customer_details && session.customer_details.email) || null,
      amountTotal: session.amount_total,
      currency: session.currency ? session.currency.toUpperCase() : null
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Verifies a webhook came from Stripe and not from anyone who found the URL.
// Signature checking is the whole security of this endpoint: without it any
// caller could mark any order paid and help themselves to the downloads. The
// raw request body is required - a parsed and re-serialised body will not match
// the signature.
function verifyWebhook(rawBody, signatureHeader) {
  const api = stripe();
  if (!api) return { ok: false, error: 'Stripe is not configured.' };
  if (!STRIPE_WEBHOOK_SECRET) return { ok: false, error: 'STRIPE_WEBHOOK_SECRET is not set.' };
  try {
    return { ok: true, event: api.webhooks.constructEvent(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = {
  isConfigured,
  isTestMode,
  webhookConfigured,
  createCheckoutSession,
  retrieveSession,
  verifyWebhook
};
