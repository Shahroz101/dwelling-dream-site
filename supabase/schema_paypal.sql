-- Adds PayPal payment support to the existing orders table, and a
-- currency column to products (business is EUR-only). Extends the
-- tables created in seed_products.sql / schema_orders.sql - does not
-- create new tables, per the "reuse what exists" instruction.
--
-- Paste this into the Supabase SQL editor and run it once.

alter table public.products
  add column if not exists currency text not null default 'EUR',
  add column if not exists active boolean not null default true;

alter table public.orders
  add column if not exists paypal_order_id text,
  add column if not exists status text not null default 'PENDING',
  add column if not exists currency text not null default 'EUR',
  add column if not exists customer_email text,
  add column if not exists updated_at timestamptz not null default now();

-- One row per PayPal order - required for capture-order's idempotency
-- check (a repeated capture request for the same PayPal order must not
-- create a second paid order). Partial index so multiple legacy rows
-- with paypal_order_id = null (orders created before this migration)
-- don't collide with each other.
create unique index if not exists orders_paypal_order_id_key
  on public.orders (paypal_order_id)
  where paypal_order_id is not null;

create index if not exists orders_status_idx on public.orders (status);

-- Backfill: any pre-existing order created by the old instant-paid stub
-- is still a real completed order from the customer's point of view.
update public.orders
  set status = 'COMPLETED'
  where paid = true and status = 'PENDING';
