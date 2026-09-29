-- Auth, devises, variantes, catégories de dépenses.

alter table users add column if not exists badge text;
alter table users add column if not exists password_hash text;

create unique index if not exists users_badge_idx on users (badge) where badge is not null;

alter table company_settings add column if not exists usd_cdf_rate numeric(12,4) not null default 2800;

alter table products add column if not exists options jsonb not null default '[]'::jsonb;
alter table product_variants add column if not exists options jsonb not null default '{}'::jsonb;

alter table sales add column if not exists received_usd numeric(12,2) not null default 0;
alter table sales add column if not exists received_cdf numeric(12,2) not null default 0;

alter table orders add column if not exists received_usd numeric(12,2) not null default 0;
alter table orders add column if not exists received_cdf numeric(12,2) not null default 0;

do $$ begin
  alter type expense_category add value if not exists 'restock';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type expense_category add value if not exists 'forfait';
exception when duplicate_object then null; end $$;
