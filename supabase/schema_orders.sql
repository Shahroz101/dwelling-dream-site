-- Dwelling Dream orders table schema (no seed data - orders.json is
-- currently empty, so this just creates the table for the live backend
-- to read/write going forward).
--
-- Mirrors the order shape built in server.js's handleApiOrders /
-- server.py's do_POST /api/orders:
--   id, token, items (product/sku/title/price/qty/digitalFiles per line),
--   total, paid, createdAt.
--
-- Paste this into the Supabase SQL editor and run it, same as
-- seed_products.sql.

create table if not exists public.orders (
  id text primary key,
  token text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
