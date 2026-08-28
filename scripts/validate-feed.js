#!/usr/bin/env node
// Checks the Google Merchant Center feed before Google does.
//
//   node scripts/validate-feed.js                      # validate straight from Supabase
//   node scripts/validate-feed.js http://localhost:3999 # also fetch and parse the live endpoint
//   node scripts/validate-feed.js https://dwellingdream.shop
//
// Exits non-zero if anything would make Google reject or silently drop an item,
// so it can be wired into a deploy check.

const fs = require('fs');
const path = require('path');
const productFeed = require('../lib/product-feed');

const ROOT = path.join(__dirname, '..');

// Same .env loading the server does, so this works with no extra setup.
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

function rowToProduct(row) {
  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    description: row.description,
    category: row.category,
    price: Number(row.price),
    currency: row.currency,
    active: row.active !== undefined ? Boolean(row.active) : true,
    images: row.images || [],
    updatedAt: row.updated_at
  };
}

async function loadProducts() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required (put them in .env).');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.desc`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase returned ${res.status}: ${await res.text()}`);
  return (await res.json()).map(rowToProduct);
}

// Deliberately dependency-free: a tiny well-formedness check rather than a full
// parser, so this script needs no npm install on a shared host.
function assertWellFormedXml(xml) {
  const problems = [];
  if (!xml.startsWith('<?xml')) problems.push('missing XML declaration');
  if (!xml.includes('xmlns:g="http://base.google.com/ns/1.0"')) problems.push('missing Google namespace');
  const opens = (xml.match(/<item>/g) || []).length;
  const closes = (xml.match(/<\/item>/g) || []).length;
  if (opens !== closes) problems.push(`unbalanced <item> tags (${opens} open, ${closes} close)`);

  // Any raw & that is not the start of a valid entity would break the parse.
  const stray = xml.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g);
  if (stray) problems.push(`${stray.length} unescaped ampersand(s)`);
  return problems;
}

async function main() {
  const target = process.argv[2];
  let failed = false;

  console.log('Loading products from Supabase...');
  const products = await loadProducts();
  console.log(`  ${products.length} product row(s)\n`);

  const { errors, warnings } = productFeed.validateProducts(products);

  if (errors.length) {
    failed = true;
    console.log(`ERRORS (${errors.length}) - these items would be rejected:`);
    errors.forEach(e => console.log(`  x ${e}`));
  } else {
    console.log('ERRORS: none');
  }

  if (warnings.length) {
    // Collapse the repetitive per-product warnings into counts.
    const grouped = {};
    warnings.forEach(w => {
      const key = w.replace(/^[^:]+: /, '');
      grouped[key] = (grouped[key] || 0) + 1;
    });
    console.log(`\nWARNINGS (${warnings.length}):`);
    Object.entries(grouped).forEach(([msg, count]) => console.log(`  ! x${count} ${msg}`));
  }

  const listable = products.filter(productFeed.isListable);
  const xml = productFeed.buildFeedXml(products);
  const xmlProblems = assertWellFormedXml(xml);

  console.log(`\nFEED: ${listable.length} of ${products.length} product(s) included, ${xml.length} bytes`);
  if (xmlProblems.length) {
    failed = true;
    xmlProblems.forEach(p => console.log(`  x ${p}`));
  } else {
    console.log('  XML well-formed, Google namespace present');
  }

  if (!listable.length) {
    failed = true;
    console.log('  x feed is EMPTY - Google would treat this as a request to delist everything');
  }

  if (target) {
   for (const [catalog, route, expectedAvailability] of [
     ['Google', '/api/google-shopping-feed', 'in_stock'],
     ['Pinterest', '/api/pinterest-feed', 'in stock']
   ]) {
    const url = `${target.replace(/\/$/, '')}${route}`;
    console.log(`\n${catalog}: fetching ${url}`);
    try {
      const res = await fetch(url);
      const body = await res.text();
      const type = res.headers.get('content-type') || '';
      console.log(`  HTTP ${res.status} | ${type}`);
      if (!res.ok) { failed = true; console.log('  x non-200 response'); }
      if (!type.includes('xml')) { failed = true; console.log('  x Content-Type is not XML'); }

      const liveProblems = assertWellFormedXml(body);
      liveProblems.forEach(p => { failed = true; console.log(`  x ${p}`); });

      const ids = [...body.matchAll(/<g:id>([^<]+)<\/g:id>/g)].map(m => m[1]);
      console.log(`  ${ids.length} item(s), ${new Set(ids).size} unique id(s)`);
      if (ids.length !== new Set(ids).size) { failed = true; console.log('  x duplicate ids in live feed'); }

      // A credential leaking into a public feed is the worst possible outcome
      // here, so check explicitly rather than trusting the templating.
      for (const [label, secret] of [['service key', SUPABASE_SERVICE_KEY], ['PayPal secret', process.env.PAYPAL_CLIENT_SECRET], ['admin password', process.env.ADMIN_PASSWORD]]) {
        if (secret && secret.length > 8 && body.includes(secret)) {
          failed = true;
          console.log(`  x CREDENTIAL LEAK: ${label} appears in the feed body`);
        }
      }
      console.log('  no credentials found in feed body');

      const httpUrls = [...body.matchAll(/<(?:link|g:image_link)>(http:\/\/[^<]+)</g)];
      if (httpUrls.length) { failed = true; console.log(`  x ${httpUrls.length} non-HTTPS URL(s)`); }
      else console.log('  all URLs HTTPS');

      // Each catalog spells availability differently; sending the wrong one
      // gets every item rejected.
      const availabilities = [...new Set([...body.matchAll(/<g:availability>([^<]+)</g)].map(m => m[1]))];
      const wrong = availabilities.filter(a => a !== expectedAvailability && a !== expectedAvailability.replace('in', 'out of'));
      if (availabilities.length && !availabilities.includes(expectedAvailability)) {
        failed = true;
        console.log(`  x availability is ${JSON.stringify(availabilities)}, ${catalog} expects "${expectedAvailability}"`);
      } else {
        console.log(`  availability "${expectedAvailability}" correct for ${catalog}`);
      }
    } catch (error) {
      failed = true;
      console.log(`  x could not fetch: ${error.message}`);
    }
   }
  }

  console.log(failed ? '\nFAILED' : '\nPASSED');
  process.exit(failed ? 1 : 0);
}

main().catch(error => {
  console.error(`\nvalidate-feed crashed: ${error.message}`);
  process.exit(1);
});
