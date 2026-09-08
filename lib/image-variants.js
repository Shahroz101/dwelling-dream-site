// Format negotiation for product images.
//
// Every product image is stored three ways in the product-images bucket:
//
//   SKU-00.jpg    the original, always present
//   SKU-00.webp   ~28% smaller
//   SKU-00.avif   ~57% smaller
//
// /product-image/SKU-00.jpg looks at the request's Accept header and serves
// the smallest format that browser actually claims to support, falling back to
// the original. The URL never changes, so feeds, JSON-LD and stored product
// rows keep referring to the .jpg and are unaffected by any of this.
//
// Deliberately no image library here: the serving path only picks between
// objects that already exist. Encoding lives in scripts/generate-image-variants.js
// and the admin upload path, so a missing encoder can never stop the site
// serving images.

// AVIF only. WebP was dropped deliberately: AVIF already covers ~93% of
// browsers, WebP would only have helped Safari 14-15, and each extra format
// costs storage on a Supabase tier that is over half full. Anything that
// cannot decode AVIF falls through to the original, which is always present.
// To reintroduce WebP, add it here and to lib/image_variants.py, then run
// scripts/generate-image-variants.js.
const VARIANT_FORMATS = [
  { ext: '.avif', accept: 'image/avif', contentType: 'image/avif' }
];

const ORIGINAL_CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif'
};

function originalContentType(objectName) {
  const dot = String(objectName || '').lastIndexOf('.');
  const ext = dot === -1 ? '' : objectName.slice(dot).toLowerCase();
  return ORIGINAL_CONTENT_TYPES[ext] || 'application/octet-stream';
}

// "SKU-00.jpg" -> "SKU-00.avif". Returns null if the name has no extension.
function variantName(objectName, ext) {
  const dot = String(objectName || '').lastIndexOf('.');
  if (dot <= 0) return null;
  return objectName.slice(0, dot) + ext;
}

// Only treat a format as supported when the Accept header names it explicitly.
// Merchant Center and Pinterest fetch images with */* and get the original,
// which is what we want - AVIF support in product feeds is not guaranteed and
// an unreadable image is worse than a larger one.
function acceptsFormat(acceptHeader, mediaType) {
  const header = String(acceptHeader || '').toLowerCase();
  if (!header) return false;
  const index = header.indexOf(mediaType);
  if (index === -1) return false;

  // Reject an explicit q=0, which means "I specifically do not want this".
  const rest = header.slice(index + mediaType.length);
  const qMatch = /^\s*;\s*q=\s*(0(?:\.0+)?)\s*(?:,|$)/.exec(rest);
  return !qMatch;
}

// Candidate object names in preference order, always ending with the original.
function negotiateVariants(objectName, acceptHeader) {
  const candidates = [];
  for (const format of VARIANT_FORMATS) {
    if (!acceptsFormat(acceptHeader, format.accept)) continue;
    const name = variantName(objectName, format.ext);
    if (name && name !== objectName) candidates.push({ name, contentType: format.contentType });
  }
  candidates.push({ name: objectName, contentType: originalContentType(objectName) });
  return candidates;
}

module.exports = {
  VARIANT_FORMATS,
  originalContentType,
  variantName,
  acceptsFormat,
  negotiateVariants
};
