# PayPal payment setup

This adds real PayPal payment verification and secure digital-download
delivery to the existing checkout. It reuses the existing Supabase
`products`/`orders` tables and the existing `digital-files` Storage
bucket - no new tables, no Edge Functions, no second product system.

## 1. Create a PayPal REST app

1. Go to https://developer.paypal.com/dashboard/applications and log in
   with (or create) a PayPal account.
2. Make sure the **Sandbox** toggle (top left) is on.
3. Click **Create App**, give it a name (e.g. "Dwelling Dream"), and pick
   your sandbox **Business** account as the merchant.
4. On the app's page you'll see a **Client ID** and, under "Show", a
   **Secret**. You'll need both in step 3 below.
5. Under Sandbox -> Accounts you'll find a pre-made sandbox **personal
   (buyer)** account with its own email/password - use that to log in and
   approve test payments in step 4.

## 2. Run the database migration

Open the Supabase dashboard -> SQL Editor, paste the contents of
`supabase/schema_paypal.sql`, and run it once. It adds `currency`/`active`
to `products`, adds `paypal_order_id`/`status`/`currency`/
`customer_email`/`updated_at` to `orders`, and a unique index on
`paypal_order_id` (this is what makes capturing the same PayPal order
twice a no-op instead of creating a duplicate paid order).

This project only talks to Supabase over its REST API, so this step has
to be done manually in the SQL Editor - there's no way to run DDL from
the app itself.

## 3. Add the credentials

**Do this by editing the `.env` file directly on disk - do not paste the
PayPal Secret into chat.** Open `.env` in the project root (create it
from `.env.example` if it doesn't exist yet) and set:

```
PAYPAL_CLIENT_ID=<your sandbox client id>
PAYPAL_CLIENT_SECRET=<your sandbox secret>
PAYPAL_ENVIRONMENT=sandbox
```

`.env` is already git-ignored, so this never reaches GitHub. Once it's
saved, say so and the same values get carried into the production `.env`
that's bundled with the next Hostinger deploy (the deploy process reads
this file directly - the values are never re-typed anywhere).

Until `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` are both set, the server
treats PayPal as "not configured": `/api/paypal/create-order` and
`/api/paypal/capture-order` return a clear 500 error instead of doing
anything, and the Cart page's checkout button will show that error rather
than let anyone check out. This is intentional - it replaces the old
`/api/orders` stub, which marked every order paid instantly with no
payment check at all.

## 4. Test a purchase (Sandbox)

1. Add a product to the cart and click **Continue to Checkout** - the
   PayPal button renders inline (the PayPal JS SDK is only loaded at this
   point, not on every page load).
2. Click it, log in with the **sandbox buyer** account from step 1, and
   approve the payment.
3. You're redirected to the order confirmation page, which only shows
   success once the backend has independently verified the capture with
   PayPal (see "How it works" below) - the browser's own claim that
   payment succeeded is never trusted on its own.
4. The confirmation page's download link streams the file from the
   private `digital-files` bucket via `/api/download`, which re-checks
   `order.paid` on the server for every request, independent of anything
   the page displays.

## 5. Uploading a digital product

In the admin panel (`/admin.html`), create or edit a product and attach a
file under its digital files section, same as before - this part hasn't
changed. The file is uploaded straight to the private `digital-files`
Storage bucket; only `/api/download` (with a valid, paid order's token)
can read it back out.

## 6. Switching to production

1. In the PayPal dashboard, toggle from **Sandbox** to **Live**, create a
   Live app the same way, and get its Client ID/Secret.
2. Update `.env`: `PAYPAL_ENVIRONMENT=production`, and replace
   `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` with the Live app's values.
3. Redeploy. No code changes are needed - `PAYPAL_ENVIRONMENT` is what
   switches the API base URL between
   `api-m.sandbox.paypal.com` and `api-m.paypal.com`.

## How it works (what's actually being verified)

- **Price**: `/api/paypal/create-order` looks up each product's price
  from Supabase and totals it in integer cents - the amount sent to
  PayPal never comes from the browser.
- **Order creation**: a PayPal order is created server-side
  (`intent: CAPTURE`), and a Supabase `orders` row is inserted with
  `status: PENDING`, `paid: false`.
- **Capture**: `/api/paypal/capture-order` calls PayPal's capture
  endpoint itself and only marks the order paid if PayPal's response
  says `status: COMPLETED` *and* the captured amount/currency (compared
  in integer cents) matches what was stored at order-creation time.
- **Idempotency**: capture first looks up the order by `paypal_order_id`.
  If it's already `COMPLETED`, it returns success immediately without
  calling PayPal's capture endpoint again or touching the database - a
  duplicate capture request (retry, double-click, replay) can't create a
  second paid order or double-fulfil one.
- **Download gating**: `/api/download` independently re-checks
  `order.paid` in Supabase on every request. The confirmation page
  displaying "success" never itself grants access to the file.

## Required environment variables (summary)

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | yes | already in use |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | yes | already in use |
| `PAYPAL_CLIENT_ID` | for checkout to work | from the PayPal app |
| `PAYPAL_CLIENT_SECRET` | for checkout to work | server-side only, never in git or frontend code |
| `PAYPAL_ENVIRONMENT` | no (defaults to `sandbox`) | `sandbox` or `production` |

## Files changed/added

- `server.js` / `server.py` - PayPal OAuth + order create/capture, `/api/config`, replaced the old always-paid `/api/orders` stub.
- `supabase/schema_paypal.sql` - the migration from step 2.
- `Dwelling Dream Cart.dc.html` - renders PayPal Buttons on checkout, EUR pricing.
- `Dwelling Dream Order.dc.html`, `Dwelling Dream Product.dc.html`, `Dwelling Dream Palettes.dc.html`, `admin.html` - EUR pricing.
- `.env.example` - variable names only, no secrets, safe to commit.
