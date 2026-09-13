# WordPress / WooCommerce build

The storefront rebuilt as a WordPress theme with WooCommerce behind it, so the
catalogue, cart, checkout, download delivery and the Pinterest/Google feeds
are all WooCommerce's. It runs on the staging subdomain until cutover:

- Staging site: https://wp.dwellingdream.shop (admin at `/wp-admin/`,
  user `dwelling_admin`, password in `.env` as `WP_ADMIN_PASSWORD`; a REST
  application password is `WP_APP_PASSWORD`).
- Hostinger install id `30592263`, theme directory
  `wp-content/themes/dwelling-dream`.
- The live Node site on dwellingdream.shop is untouched by any of this.

## Layout

```
wordpress/dwelling-dream/          the theme (deployable as-is)
  functions.php, inc/              WordPress/WooCommerce glue, REST endpoints
  header.php, footer.php           shared nav + footer (from the design pages)
  front-page.php, page-*.php       GENERATED from the design pages
  woocommerce/archive-product.php  GENERATED - the Palettes catalogue
  woocommerce/single-product.php   GENERATED - product page, filled by WooCommerce
  woocommerce/checkout/thankyou.php order confirmation, in the Order page design
  js/cart.js                       Store-API cart with the old cart.js exports
  js/interactions.js               copied from the repo root
  templates-src/                   hand-written scripts spliced into generated pages
  assets/, data/reviews.json       copied from the repo
scripts/build-wp-theme.js          design pages -> theme templates
scripts/import-to-woocommerce.js   Supabase catalogue -> WooCommerce products
```

Every page keeps the design page's inline-styled markup verbatim. The build
script only splits out header/footer, rewrites `/assets/` and module paths,
and points the page scripts at the theme's REST routes (`/wp-json/dd/v1/...`)
which mirror the Node `/api/...` responses.

## Editing

- Design change: edit the `.dc.html` page, run
  `node scripts/build-wp-theme.js`, upload the changed template.
- Behaviour change on the cart or product page: edit
  `templates-src/*.js`, rebuild.
- Anything else: edit the theme file directly.

Hostinger does not expose SSH; files are uploaded with the file-manager TUS
API (`hosting_generateUploadURLV1` for credentials, then POST + PATCH per
file - see the `push-theme.sh` helper pattern in the session notes). The
`hosting_deployWordpressTheme` tool uploads a whole theme and activates it, but
it lands in a random-suffixed folder and does not fire `after_switch_theme`,
so after a fresh deploy run `POST /wp-json/dd/v1/setup` (admin) to create
the pages.

## URLs

Same as the Node site: `/`, `/palettes/`, `/palettes/<slug>/`, `/about/`,
`/help/`, `/help/<policy>/`, `/contact/`, `/cart/`, plus WooCommerce's
`/checkout/` and `/my-account/`. The product permalink base is `/palettes/`
and the shop page has slug `palettes`.

## Catalogue import

`node scripts/import-to-woocommerce.js` copies every Supabase product into
WooCommerce (matched by SKU, so it is re-runnable). Digital files go to
`wp-content/uploads/woocommerce_uploads/dd/` - the folder WooCommerce blocks
direct access to - and are attached as downloadable files. Product photos are
sideloaded from `dwellingdream.shop/product-image/`. The theme limits
generated image sizes to `large` + the WooCommerce thumbnail to keep that
affordable on shared hosting; the script pauses between products for the
same reason. Hostinger's CDN rate-limits bursts from one IP with a `307` to
`/` - wait it out rather than retrying hard.

## Still manual

- Stripe: WooCommerce → Settings → Payments → Stripe → Connect (OAuth).
- Pinterest: Marketing → Pinterest → Connect (OAuth; the domain claim is
  inherited from dwellingdream.shop).
- Cutover: point dwellingdream.shop at the WordPress install and add the
  feed URLs to Merchant Center / Pinterest.
