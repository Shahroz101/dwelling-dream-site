# Payments — Stripe Checkout

The storefront takes payment through **Stripe Checkout**, hosted by Stripe.
A buyer is redirected to Stripe's own payment page and returned here
afterwards. Card details never touch this server, which keeps the store in the
narrowest PCI scope (SAQ A), and Apple Pay, Google Pay and Link are available
without any extra work.

This replaced a PayPal integration. Nothing PayPal remains in the running code.

## The flow

```
Cart / Buy now
  -> POST /api/checkout/create-session      order row written (PENDING)
  -> checkout.stripe.com                    buyer pays
  -> POST /api/stripe/webhook               payment confirmed, emails sent
  -> /order?order=..&token=..               downloads
```

**Payment is confirmed by the webhook, never by the browser.** The buyer
returning to the success URL proves nothing — anyone can visit a URL. The order
is marked paid only after Stripe tells us so, over a signature-verified webhook.

Because webhooks can be delayed or lost, `GET /api/orders/:id` also reconciles:
if an order is unpaid but has a session attached, the server asks Stripe
directly. That is still Stripe answering, not the browser being trusted.

Both paths call the same `fulfilOrder()`, which returns early on an
already-paid order — so a webhook and a page load racing each other cannot send
a buyer two receipts.

## Setup

1. **API key** — dashboard.stripe.com → Developers → API keys. Copy the
   **secret key**. Use `sk_test_…` until you are ready for real money.
2. **Webhook** — Developers → Webhooks → Add endpoint:
   - URL: `https://dwellingdream.shop/api/stripe/webhook`
   - Events: `checkout.session.completed` (and
     `checkout.session.async_payment_succeeded` for delayed methods)
   - Copy the signing secret (`whsec_…`).
3. **Environment variables** — set these in Hostinger's Node.js panel, not in
   `.env`. A git-source build lands without `.env`, and the app then starts
   without payments:

   | Variable | Value |
   |---|---|
   | `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` |

   Saving restarts the app.
4. **Test** — pay with `4242 4242 4242 4242`, any future expiry, any CVC.
   Confirm the confirmation email arrives, the sale notification arrives, and
   the download link works.

## Test mode is visible

`GET /api/config` reports `paymentsTestMode`. This exists because the previous
PayPal integration sat in sandbox while looking entirely operational, and no
real customer could pay. Check it after going live:

```
curl -s https://dwellingdream.shop/api/config
```

`paymentsTestMode: true` means no real money can be taken.

## Failure behaviour

Checkout is allowed to be unconfigured. Without `STRIPE_SECRET_KEY` the catalog,
admin, existing orders and their downloads all keep working, and only checkout
answers 503 with a clear message. The Stripe library is loaded defensively for
the same reason: a build landing without `node_modules` must not stop the
process binding a port and take the whole storefront down over a payment
library.

Without `STRIPE_WEBHOOK_SECRET` the webhook refuses every request, since the
signature is the only thing separating Stripe from anyone who found the URL.
Orders are then confirmed on the reconcile path instead — slower, but correct.

## The order reference column

The provider's reference (now a Stripe Checkout session id) is stored in
`orders.paypal_order_id`, the column PayPal created. The code prefers a
`payment_ref` column and falls back, so renaming is optional and can happen at
any time without coordinating with a deploy:

```sql
alter table public.orders rename column paypal_order_id to payment_ref;
```

`supabase/schema_paypal.sql` is kept as the historical migration that created
those columns. It has already been applied; it is not re-run.
