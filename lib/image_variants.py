"""Python mirror of lib/image-variants.js.

server.js is the deployed runtime; server.py is a parallel implementation, so
this exists to stop the two diverging. Any change to one must be made to the
other.

Every product image is stored three ways in the product-images bucket:

    SKU-00.jpg     the original, always present
    SKU-00.webp    ~28% smaller
    SKU-00.avif    ~57% smaller

/product-image/SKU-00.jpg reads the request's Accept header and serves the
smallest format that browser actually claims to support, falling back to the
original. The URL never changes, so feeds, JSON-LD and stored product rows keep
referring to the .jpg and are unaffected.

Deliberately no image library here: the serving path only picks between objects
that already exist, so a missing encoder can never stop the site serving images.
"""

import os
import re

# AVIF only. WebP was dropped deliberately: AVIF already covers ~93% of
# browsers, WebP would only have helped Safari 14-15, and each extra format
# costs storage on a Supabase tier that is over half full. Anything that cannot
# decode AVIF falls through to the original, which is always present.
VARIANT_FORMATS = [
    {"ext": ".avif", "accept": "image/avif", "content_type": "image/avif"},
]

ORIGINAL_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
}


def original_content_type(object_name):
    ext = os.path.splitext(str(object_name or ""))[1].lower()
    return ORIGINAL_CONTENT_TYPES.get(ext, "application/octet-stream")


def variant_name(object_name, ext):
    """'SKU-00.jpg' -> 'SKU-00.avif'. None if the name has no extension."""
    base, current = os.path.splitext(str(object_name or ""))
    if not base or not current:
        return None
    return base + ext


def accepts_format(accept_header, media_type):
    """Only treat a format as supported when Accept names it explicitly.

    Merchant Center and Pinterest fetch images with */* and get the original,
    which is what we want - AVIF support in product feeds is not guaranteed and
    an unreadable image is worse than a larger one.
    """
    header = str(accept_header or "").lower()
    if not header:
        return False
    index = header.find(media_type)
    if index == -1:
        return False
    # Reject an explicit q=0, which means "I specifically do not want this".
    rest = header[index + len(media_type):]
    return re.match(r"^\s*;\s*q=\s*0(?:\.0+)?\s*(?:,|$)", rest) is None


def negotiate_variants(object_name, accept_header):
    """Candidate object names in preference order, always ending with the original."""
    candidates = []
    for fmt in VARIANT_FORMATS:
        if not accepts_format(accept_header, fmt["accept"]):
            continue
        name = variant_name(object_name, fmt["ext"])
        if name and name != object_name:
            candidates.append({"name": name, "content_type": fmt["content_type"]})
    candidates.append({"name": object_name, "content_type": original_content_type(object_name)})
    return candidates
