#!/usr/bin/env node
// Turns the storefront's design pages ("Dwelling Dream *.dc.html") into
// WordPress theme templates under wordpress/dwelling-dream/.
//
//   node scripts/build-wp-theme.js
//
// The pages are self-contained inline-styled HTML, so their markup is carried
// over verbatim. What changes: the shared header/footer are split out into
// header.php/footer.php, asset and module paths point into the theme, the
// Node API routes point at the theme's REST endpoints, and each page's
// <helmet> (title, meta description, page <style>) is handed to dd_page_head().
//
// Hand-written templates (functions.php, header.php, footer.php, the product
// page, the cart page, the thank-you page, cart.js) live alongside and are
// never touched by this script - it only writes the files listed in PAGES.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const THEME = path.join(ROOT, 'wordpress', 'dwelling-dream');

// source page -> theme template. "page-<slug>.php" is picked up by WordPress
// for the page with that slug; front-page.php for the homepage; the
// WooCommerce archive template for the palettes catalogue.
const PAGES = [
  { file: 'Dwelling Dream Homepage v2.dc.html', out: 'front-page.php', threshold: null },
  { file: 'Dwelling Dream Palettes.dc.html', out: 'woocommerce/archive-product.php', threshold: -1 },
  { file: 'Dwelling Dream About.dc.html', out: 'page-about.php', threshold: -1 },
  { file: 'Dwelling Dream Help.dc.html', out: 'page-help.php', threshold: -1 },
  { file: 'Dwelling Dream Contact.dc.html', out: 'page-contact.php', threshold: -1 },
  { file: 'Dwelling Dream Shipping Policy.dc.html', out: 'page-shipping-policy.php', threshold: -1 },
  { file: 'Dwelling Dream Return Policy.dc.html', out: 'page-return-policy.php', threshold: -1 },
  { file: 'Dwelling Dream Privacy Policy.dc.html', out: 'page-privacy-policy.php', threshold: -1 },
  { file: 'Dwelling Dream Terms of Service.dc.html', out: 'page-terms-of-service.php', threshold: -1 },
  // The cart page keeps its markup but gets a WooCommerce-backed script, which
  // is hand-written in templates-src/cart-script.js.
  { file: 'Dwelling Dream Cart.dc.html', out: 'page-cart.php', threshold: -1, script: 'cart-script.js' },
  // The product page is server-rendered from WooCommerce; its markup is the
  // design page's, its script is hand-written in templates-src/product-script.js.
  { file: 'Dwelling Dream Product.dc.html', out: 'woocommerce/single-product.php', threshold: -1, script: 'product-script.js', product: true }
];

function between(text, startMarker, endMarker, { fromIndex = 0 } = {}) {
  const start = text.indexOf(startMarker, fromIndex);
  if (start < 0) return null;
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) return null;
  return { inner: text.slice(start + startMarker.length, end), start, end: end + endMarker.length };
}

// Removes an element and everything inside it, given the opening-tag prefix
// and the closing tag. Only used for blocks that never nest the same tag
// (the header and the page footer), so a plain indexOf is enough.
function cutBlock(text, openPrefix, closeTag) {
  const start = text.indexOf(openPrefix);
  if (start < 0) return text;
  const end = text.indexOf(closeTag, start);
  if (end < 0) return text;
  return text.slice(0, start) + text.slice(end + closeTag.length);
}

function rewritePaths(html) {
  return html
    .replace(/(["'(])\/assets\//g, '$1<?php echo DD_ASSETS; ?>/')
    // Internal links: WordPress canonicalises to a trailing slash, so link
    // straight to it rather than through a redirect on every click.
    .replace(/href="\/(about|help|contact|palettes|cart|checkout)"/g, 'href="/$1/"')
    .replace(/href="\/help\/(shipping-policy|return-policy|privacy-policy|terms-of-service)"/g, 'href="/help/$1/"')
    .replace(/href="\/palettes\/([a-z0-9-]+)"/g, 'href="/palettes/$1/"');
}

function rewriteScript(js) {
  return js
    .replace(/from '\/interactions\.js'/g, "from '<?php echo DD_URI; ?>/js/interactions.js'")
    .replace(/from '\/cart\.js'/g, "from '<?php echo DD_URI; ?>/js/cart.js'")
    .replace(/`\$\{base\}\/api\/products`/g, "'/wp-json/dd/v1/products'")
    .replace(/'\/api\/products'/g, "'/wp-json/dd/v1/products'")
    .replace(/'\/api\/reviews'/g, "'/wp-json/dd/v1/reviews'")
    .replace(/'\/api\/contact'/g, "'/wp-json/dd/v1/contact'")
    .replace(/href = `\/palettes\/\$\{productSlug\(product\)\}`/g, 'href = `/palettes/${productSlug(product)}/`')
    .replace(/`\/palettes\/\$\{productSlug\(product\)\}`/g, '`/palettes/${productSlug(product)}/`');
}

function phpString(value) {
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function build(page) {
  const src = fs.readFileSync(path.join(ROOT, page.file), 'utf8');

  const helmet = between(src, '<helmet>', '</helmet>');
  if (!helmet) throw new Error(`${page.file}: no <helmet>`);
  const title = (between(helmet.inner, '<title>', '</title>') || { inner: '' }).inner.trim();
  const descMatch = helmet.inner.match(/<meta name="description" content="([^"]*)"/);
  const description = descMatch ? descMatch[1] : '';
  const style = (between(helmet.inner, '<style>', '</style>') || { inner: '' }).inner;

  const dc = between(src, '</helmet>', '</x-dc>');
  if (!dc) throw new Error(`${page.file}: no page body`);
  let body = dc.inner;

  // Shared chrome lives in header.php / footer.php.
  body = body.replace(/^\s*<div style="position: relative; width: 100%; overflow-x: hidden; background: #F5F2EA;">/, '');
  body = cutBlock(body, '<div data-progress=""', '</div>');
  body = cutBlock(body, '<header', '</header>');
  body = cutBlock(body, '<footer style="background: #292825; color: #A9A29A;', '</footer>');
  // The wrapper div's closing tag is now unbalanced - drop the last "</div>".
  const lastDiv = body.lastIndexOf('</div>');
  if (lastDiv >= 0) body = body.slice(0, lastDiv) + body.slice(lastDiv + '</div>'.length);
  body = rewritePaths(body.trim());

  let script;
  if (page.script) {
    script = fs.readFileSync(path.join(THEME, 'templates-src', page.script), 'utf8');
  } else {
    const mod = between(src, '<script type="module">', '</script>');
    script = mod ? rewriteScript(mod.inner) : '';
  }

  // The product page's title and description come from the product itself.
  const titleExpr = page.product ? "$dd['title'] . ' — Dwelling Dream'" : phpString(title);
  const descExpr = page.product
    ? "$dd['title'] . ($dd['category'] ? ' by ' . $dd['category'] : '') . '. ' . $dd['description']"
    : phpString(description);
  const head = [
    `dd_page_head(array(`,
    `  'title' => ${titleExpr},`,
    `  'description' => ${descExpr},`,
    `  'style' => <<<'CSS'`,
    style.trim(),
    `CSS`,
    `));`
  ].join('\n');

  const out = [
    '<?php',
    `// Generated from "${page.file}" by scripts/build-wp-theme.js - edit the`,
    '// design page and rebuild rather than editing this file.',
    'if (!defined(\'ABSPATH\')) exit;',
    page.product ? '$dd = dd_product_view(wc_get_product(get_queried_object_id()));' : '',
    head,
    'get_header();',
    '?>',
    page.product ? applyProductBindings(body) : body,
    '',
    '<script type="module">',
    script.trim(),
    '</script>',
    '<?php get_footer(); ?>',
    ''
  ].filter(line => line !== '').join('\n');

  const outPath = path.join(THEME, page.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out);
  console.log(`  ${page.out}  <-  ${page.file}`);
}

// The product page ships with placeholder text ("Product", "$0.00", one
// gallery slot) that the old client script filled in from /api/products.
// Here WooCommerce fills them server-side so crawlers - Pinterest included -
// see the real title, price and images without running JavaScript.
function applyProductBindings(body) {
  return body
    .replace('<span data-product-breadcrumb style="color: #292825;">Product</span>',
      '<span data-product-breadcrumb style="color: #292825;"><?php echo esc_html($dd[\'title\']); ?></span>')
    .replace(/<div data-main-media=""[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<div role="tablist" aria-label="Product images"[^>]*>[\s\S]*?<\/div>/,
      '<?php dd_product_gallery($dd); ?>')
    .replace('<p data-product-brand style="margin: 0; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Brand</p>',
      '<p data-product-brand style="margin: 0; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;"><?php echo esc_html($dd[\'category\']); ?></p>')
    .replace(/(<h1 id="p-h"[^>]*>)Product(<\/h1>)/, '$1<?php echo esc_html($dd[\'title\']); ?>$2')
    .replace(/(<p data-product-summary[^>]*>)Loading description\.\.\.(<\/p>)/, '$1<?php echo esc_html($dd[\'description\']); ?>$2')
    .replace(/(<p data-product-price[^>]*>)\$0\.00(<\/p>)/, '$1<?php echo esc_html($dd[\'price_text\']); ?>$2')
    .replace(/Add to cart — \$16\.00/g, 'Add to cart — <?php echo esc_html($dd[\'price_text\']); ?>')
    .replace('<div data-rec-grid="" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 320px)); justify-content: start; gap: clamp(16px, 2vw, 30px);">\n      </div>',
      '<div data-rec-grid="" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 320px)); justify-content: start; gap: clamp(16px, 2vw, 30px);">\n        <?php dd_product_recommended($dd); ?>\n      </div>');
}

console.log('Building theme templates into wordpress/dwelling-dream/');
PAGES.forEach(build);

// Static files the pages reference.
const copies = [
  ['interactions.js', 'js/interactions.js'],
  ['data/reviews.json', 'data/reviews.json']
];
for (const [from, to] of copies) {
  const dest = path.join(THEME, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, from), dest);
  console.log(`  ${to}  <-  ${from}`);
}
const assetsDir = path.join(ROOT, 'assets');
const assetsOut = path.join(THEME, 'assets');
fs.mkdirSync(assetsOut, { recursive: true });
for (const name of fs.readdirSync(assetsDir)) {
  fs.copyFileSync(path.join(assetsDir, name), path.join(assetsOut, name));
}
console.log(`  assets/ (${fs.readdirSync(assetsDir).length} files)`);
console.log('Done.');
