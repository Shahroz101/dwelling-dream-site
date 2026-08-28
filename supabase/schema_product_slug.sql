-- Stable product slugs.
--
-- Until now a product's URL was derived on the fly from category + title:
--
--     slugify(category || ' ' || title)
--
-- which means renaming a product silently changes its public URL. Old links,
-- shares and search-engine results 404, and Google Merchant Center sees the
-- item move to a new `link` on the next fetch.
--
-- This adds a persisted slug so the URL is set once, at creation, and stays
-- put through any number of retitles.
--
-- Run this in the Supabase dashboard (SQL Editor). It is safe to run twice.
--
-- The backfill below reproduces the exact JavaScript slug rule, so every
-- product keeps the URL it already has - nothing 404s the moment you run it.

alter table public.products
  add column if not exists slug text;

-- Mirrors productSlug() in lib/product-feed.js:
--   base = title already contains the category ? title : category + ' ' + title
--   slug = lowercase, every run of non-alphanumerics becomes '-', trimmed
update public.products
set slug = trim(both '-' from lower(regexp_replace(
      case
        when position(lower(coalesce(category, '')) in lower(coalesce(title, ''))) > 0
          then coalesce(title, '')
        else coalesce(category, '') || ' ' || coalesce(title, '')
      end,
      '[^a-zA-Z0-9]+', '-', 'g')))
where slug is null or slug = '';

-- Two products must never resolve to the same URL.
create unique index if not exists products_slug_key
  on public.products (slug)
  where slug is not null;

-- Sanity check - should return zero rows.
-- select id, sku, title from public.products where slug is null or slug = '';
