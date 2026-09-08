#!/usr/bin/env node
// Generates .avif companions for every product image in Supabase.
//
//   node scripts/generate-image-variants.js            # generate what's missing
//   node scripts/generate-image-variants.js --dry-run  # report only
//   node scripts/generate-image-variants.js --force    # re-encode existing
//
// Requires sharp, which is an optional dependency:  npm install sharp
//
// Safe to re-run: existing variants are skipped unless --force. Nothing is
// deleted, and the original object is never touched - it stays the canonical
// image that the product rows, feeds and JSON-LD all point at.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET = 'product-images';
const HEADERS = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };

// Quality settings. AVIF at 50 is visually indistinguishable from the source
// at this image size while roughly halving it; effort 4 keeps encoding to a
// couple of seconds per image rather than tens.
const AVIF = { quality: 50, effort: 4 };
const WEBP = { quality: 78 };

const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('sharp is not installed. Run:  npm install sharp');
  process.exit(1);
}

async function listAll() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 5000 })
  });
  if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function download(name) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, { headers: HEADERS });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function upload(name, buffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: buffer
  });
  if (!res.ok) throw new Error(`upload ${name} failed: ${res.status} ${(await res.text()).slice(0, 120)}`);
}

function baseName(name) {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? name : name.slice(0, dot);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required (put them in .env).');
    process.exit(1);
  }

  const objects = await listAll();
  const present = new Set(objects.map(o => o.name));
  const sources = objects.filter(o => SOURCE_EXTENSIONS.has(path.extname(o.name).toLowerCase()));

  console.log(`bucket holds ${objects.length} object(s); ${sources.length} are source images`);

  const work = [];
  for (const object of sources) {
    for (const [ext, type] of [['.avif', 'image/avif']]) {
      const name = baseName(object.name) + ext;
      if (!force && present.has(name)) continue;
      work.push({ source: object.name, name, ext, type });
    }
  }

  console.log(`${work.length} variant(s) to generate${force ? ' (forced)' : ''}`);
  if (dryRun) {
    work.slice(0, 10).forEach(w => console.log(`  would generate ${w.name}`));
    if (work.length > 10) console.log(`  ... and ${work.length - 10} more`);
    return;
  }
  if (!work.length) return;

  // Group by source so each original is downloaded once, not twice.
  const bySource = new Map();
  for (const item of work) {
    if (!bySource.has(item.source)) bySource.set(item.source, []);
    bySource.get(item.source).push(item);
  }

  let done = 0, failed = 0, savedBytes = 0, originalBytes = 0;
  const entries = [...bySource.entries()];
  const CONCURRENCY = 4;

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    await Promise.all(entries.slice(i, i + CONCURRENCY).map(async ([source, items]) => {
      let input;
      try {
        input = await download(source);
        if (!input) throw new Error('download returned nothing');
      } catch (error) {
        failed += items.length;
        console.log(`  FAIL ${source}: ${error.message}`);
        return;
      }
      for (const item of items) {
        try {
          const pipeline = sharp(input, { failOn: 'none' });
          const output = item.ext === '.avif'
            ? await pipeline.avif(AVIF).toBuffer()
            : await pipeline.webp(WEBP).toBuffer();
          await upload(item.name, output, item.type);
          originalBytes += input.length;
          savedBytes += input.length - output.length;
          done += 1;
        } catch (error) {
          failed += 1;
          console.log(`  FAIL ${item.name}: ${error.message}`);
        }
      }
    }));
    process.stdout.write(`\r  ${done} generated, ${failed} failed  (${Math.min(i + CONCURRENCY, entries.length)}/${entries.length} sources)   `);
  }

  console.log(`\nDONE generated=${done} failed=${failed}`);
  if (done) {
    console.log(`  average size reduction: ${Math.round((savedBytes / originalBytes) * 100)}%`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch(error => {
  console.error(`\ngenerate-image-variants crashed: ${error.message}`);
  process.exit(1);
});
