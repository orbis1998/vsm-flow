create table if not exists driver_stock (
  id text primary key,
  driver_id text not null references delivery_drivers(id) on delete cascade,
  product_id text not null references products(id) on delete cascade,
  variant_id text references product_variants(id) on delete set null,
  quantity integer not null default 0,
  updated_at timestamptz not null default now()
);
