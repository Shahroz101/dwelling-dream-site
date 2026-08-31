-- GBP pricing for the United Kingdom.
--
-- Google requires the price in a feed to match the price on the landing page
-- the feed links to. Converting USD to GBP at request time cannot satisfy that:
-- the rate moves between Google's fetch and the shopper's visit, and the site
-- would still charge USD. So the GBP price is a fixed price point stored
-- alongside the USD one, and the site charges exactly that.
--
-- Run this in the Supabase dashboard (SQL Editor). Safe to run twice.
--
-- Until this runs, the application simply does not offer GBP: the GB feed
-- returns no items and every page stays in USD. Nothing breaks.

alter table public.products
  add column if not exists price_gbp numeric;

-- £14.99 for every existing product. Change a single product afterwards with:
--   update public.products set price_gbp = 19.99 where sku = 'SHER-RETR-1450';
update public.products
set price_gbp = 14.99
where price_gbp is null;

-- A product with no GBP price is excluded from the GB feed rather than being
-- advertised at a price the checkout would not honour.
-- Sanity check - should return zero rows:
--   select sku, title from public.products where price_gbp is null and active;
