alter table products add column if not exists image_url text not null default '';
alter table orders alter column customer_id drop not null;
