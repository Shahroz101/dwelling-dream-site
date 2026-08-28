"""Python mirror of lib/product-feed.js.

server.js is the deployed runtime; server.py is kept as a parallel
implementation, so this module exists to stop the two diverging. Any change to
one must be made to the other - the field mapping, the brand, the category map
and the availability rule all have to agree, because both can render the same
product page and the same Merchant Center feed.

Single source of truth for everything derived from a Supabase product row: its
public URL, price, images, and the three published representations - the Google
Merchant Center feed, the Product JSON-LD on the product page, and the sitemap.
"""

import json
import re

SITE_ORIGIN = "https://dwellingdream.shop"

# These palettes are Dwelling Dream's own work. The paint manufacturer named on
# a palette (Behr, Sherwin Williams, Benjamin Moore) is the paint the colors
# refer to - it is NOT the brand of the product being sold, and claiming it
# would misrepresent these as official manufacturer products. The manufacturer
# goes in product_type instead.
BRAND = "Dwelling Dream"

# Google's taxonomy (https://support.google.com/merchants/answer/6324436).
# Deliberately empty: google_product_category is optional, Google auto-classifies
# when absent, and a confidently-wrong category is worse than none. Add an
# internal category here to override, e.g. {"Behr": "Home & Garden > Decor"}.
GOOGLE_PRODUCT_CATEGORY = {}

_CONTROL_CHARS = re.compile(r"[\x00-\x1F\x7F]")


def slugify(value):
    text = re.sub(r"[^a-z0-9]+", "-", str(value or "").lower().strip())
    return text.strip("-")


def product_slug(product):
    title = product.get("title") or ""
    category = product.get("category") or ""
    base = title if category.lower() in title.lower() else f"{category} {title}"
    return slugify(base)


def product_url(product):
    return f"{SITE_ORIGIN}/Dwelling%20Dream%20Product.dc.html?slug={product_slug(product)}"


def product_images(product):
    return [u for u in (product.get("images") or []) if isinstance(u, str) and u.startswith("https://")]


def price_amount(product):
    try:
        value = float(product.get("price"))
    except (TypeError, ValueError):
        return None
    return f"{value:.2f}" if value > 0 else None


def currency_of(product):
    return str(product.get("currency") or "USD").upper()


def availability_of(product):
    # `active` is the only publication state this schema has - no draft,
    # sold-out or hidden flag. Digital downloads never run out of stock.
    return "out_of_stock" if product.get("active") is False else "in_stock"


def is_listable(product):
    return bool(
        product
        and product.get("active") is not False
        and product.get("id")
        and (product.get("title") or "").strip()
        and (product.get("description") or "").strip()
        and price_amount(product)
        and product_images(product)
    )


def escape_xml(value):
    return (
        str("" if value is None else value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def clean_text(value, max_length=None):
    """Google rejects raw control characters even when XML-escaped."""
    text = _CONTROL_CHARS.sub(" ", str("" if value is None else value))
    text = re.sub(r"\s+", " ", text).strip()
    if max_length and len(text) > max_length:
        return text[: max_length - 1].rstrip() + "…"
    return text


def feed_item(product):
    images = product_images(product)
    category = product.get("category")
    return {
        "id": str(product.get("id")),
        "title": clean_text(product.get("title"), 150),
        "description": clean_text(product.get("description"), 5000),
        "link": product_url(product),
        "image_link": images[0] if images else None,
        "additional_image_link": images[1:11],
        "availability": availability_of(product),
        "price": f"{price_amount(product)} {currency_of(product)}",
        "brand": BRAND,
        "condition": "new",
        # No GTIN/UPC/EAN exists for these and inventing one is a policy
        # violation, so tell Google none exists and identify by brand + mpn.
        "identifier_exists": "no",
        "mpn": product.get("sku") or None,
        "product_type": f"Paint Color Palettes > {category}" if category else "Paint Color Palettes",
        "google_product_category": GOOGLE_PRODUCT_CATEGORY.get(category),
    }


def build_feed_xml(products, generated_at=None):
    from email.utils import format_datetime
    from datetime import datetime, timezone

    generated_at = generated_at or datetime.now(timezone.utc)
    blocks = []
    for product in products:
        if not is_listable(product):
            continue
        item = feed_item(product)
        lines = [
            f"      <g:id>{escape_xml(item['id'])}</g:id>",
            f"      <title>{escape_xml(item['title'])}</title>",
            f"      <description>{escape_xml(item['description'])}</description>",
            f"      <link>{escape_xml(item['link'])}</link>",
            f"      <g:image_link>{escape_xml(item['image_link'])}</g:image_link>",
        ]
        lines += [f"      <g:additional_image_link>{escape_xml(u)}</g:additional_image_link>"
                  for u in item["additional_image_link"]]
        lines += [
            f"      <g:availability>{escape_xml(item['availability'])}</g:availability>",
            f"      <g:price>{escape_xml(item['price'])}</g:price>",
            f"      <g:brand>{escape_xml(item['brand'])}</g:brand>",
            f"      <g:condition>{escape_xml(item['condition'])}</g:condition>",
            f"      <g:identifier_exists>{escape_xml(item['identifier_exists'])}</g:identifier_exists>",
        ]
        if item["mpn"]:
            lines.append(f"      <g:mpn>{escape_xml(item['mpn'])}</g:mpn>")
        if item["google_product_category"]:
            lines.append(f"      <g:google_product_category>{escape_xml(item['google_product_category'])}</g:google_product_category>")
        lines.append(f"      <g:product_type>{escape_xml(item['product_type'])}</g:product_type>")
        blocks.append("    <item>\n" + "\n".join(lines) + "\n    </item>")

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n'
        "  <channel>\n"
        "    <title>Dwelling Dream</title>\n"
        f"    <link>{escape_xml(SITE_ORIGIN)}</link>\n"
        "    <description>Digital paint color palettes, guides and planners - instant download.</description>\n"
        f"    <lastBuildDate>{escape_xml(format_datetime(generated_at))}</lastBuildDate>\n"
        + "\n".join(blocks)
        + "\n  </channel>\n</rss>\n"
    )


def product_json_ld(product):
    """Mirrors feed_item() field for field so page and feed cannot disagree."""
    images = product_images(product)
    schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": clean_text(product.get("title"), 150),
        "description": clean_text(product.get("description"), 5000),
        "image": images[:10],
        "url": product_url(product),
        "brand": {"@type": "Brand", "name": BRAND},
        "offers": {
            "@type": "Offer",
            "price": price_amount(product),
            "priceCurrency": currency_of(product),
            "availability": "https://schema.org/InStock"
            if availability_of(product) == "in_stock"
            else "https://schema.org/OutOfStock",
            "url": product_url(product),
            "itemCondition": "https://schema.org/NewCondition",
        },
    }
    if product.get("sku"):
        schema["sku"] = product["sku"]
    if product.get("category"):
        schema["category"] = f"Paint Color Palettes > {product['category']}"
    return schema


def product_json_ld_script(product):
    """`</` is escaped so a description containing "</script>" cannot break out."""
    payload = json.dumps(product_json_ld(product), ensure_ascii=False).replace("<", "\\u003c")
    return f'<script type="application/ld+json">{payload}</script>\n'


def validate_products(products):
    errors, warnings = [], []
    seen_ids, seen_urls = {}, {}

    for product in products:
        label = product.get("sku") or product.get("id") or "(unknown)"

        if not product.get("id"):
            errors.append(f"{label}: missing id")
        elif str(product["id"]) in seen_ids:
            errors.append(f"{label}: duplicate id \"{product['id']}\" (also {seen_ids[str(product['id'])]})")
        else:
            seen_ids[str(product["id"])] = label

        if not (product.get("title") or "").strip():
            errors.append(f"{label}: missing title")
        if not (product.get("description") or "").strip():
            errors.append(f"{label}: missing description")
        if not price_amount(product):
            errors.append(f"{label}: missing or invalid price ({product.get('price')!r})")
        if not re.match(r"^[A-Z]{3}$", currency_of(product)):
            errors.append(f"{label}: invalid currency \"{product.get('currency')}\"")

        url = product_url(product)
        if not url.startswith("https://"):
            errors.append(f"{label}: product URL is not HTTPS")
        if url in seen_urls:
            errors.append(f"{label}: duplicate product URL with {seen_urls[url]} - slugs collide")
        else:
            seen_urls[url] = label

        all_images = product.get("images") or []
        https_images = product_images(product)
        if not all_images:
            errors.append(f"{label}: no images")
        elif not https_images:
            errors.append(f"{label}: no HTTPS images ({len(all_images)} non-HTTPS dropped)")
        elif len(https_images) < len(all_images):
            warnings.append(f"{label}: {len(all_images) - len(https_images)} non-HTTPS image(s) dropped")

        if not product.get("sku"):
            warnings.append(f"{label}: no SKU - item will be sent without g:mpn")
        if not GOOGLE_PRODUCT_CATEGORY.get(product.get("category")):
            warnings.append(f"{label}: no google_product_category mapped for \"{product.get('category')}\" - Google will auto-classify")
        if product.get("active") is False:
            warnings.append(f"{label}: inactive - excluded from feed")

    return errors, warnings


def build_sitemap_xml(products):
    static_paths = [
        "/",
        "/Dwelling%20Dream%20Palettes.dc.html",
        "/Dwelling%20Dream%20About.dc.html",
        "/Dwelling%20Dream%20Help.dc.html",
    ]
    urls = [f"  <url>\n    <loc>{escape_xml(SITE_ORIGIN + p)}</loc>\n  </url>" for p in static_paths]
    for product in products:
        if not is_listable(product):
            continue
        lastmod = str(product.get("updatedAt") or "")[:10]
        entry = f"  <url>\n    <loc>{escape_xml(product_url(product))}</loc>"
        if lastmod:
            entry += f"\n    <lastmod>{escape_xml(lastmod)}</lastmod>"
        urls.append(entry + "\n  </url>")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )


ROBOTS_TXT = "\n".join([
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin.html",
    "Disallow: /login.html",
    "Disallow: /api/",
    # Longest-match wins, so this re-permits the Merchant Center feed that the
    # broader /api/ rule would otherwise cover.
    "Allow: /api/google-shopping-feed",
    "",
    f"Sitemap: {SITE_ORIGIN}/sitemap.xml",
    "",
])
