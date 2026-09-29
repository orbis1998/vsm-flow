-- VSM Business Suite — schéma public
-- Aligné sur src/types/index.ts + tables opérationnelles du cahier des charges.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type role_code as enum (
    'ADMIN', 'GERANT', 'LIVREUR', 'CAISSIER', 'MAGASINIER', 'COMPTABLE', 'RESP_LOGISTIQUE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('actif', 'suspendu', 'inactif');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_level as enum ('info', 'alerte', 'critique');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unit_code as enum ('pièce', 'paire', 'carton', 'kg', 'lot');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_movement_type as enum (
    'entree', 'sortie', 'transfert', 'ajustement', 'inventaire',
    'endommage', 'perte', 'expire', 'retour'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type purchase_order_status as enum ('brouillon', 'envoyee', 'partielle', 'recue', 'annulee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'nouvelle', 'a_preparer', 'prete', 'assignee', 'en_livraison',
    'livree', 'echec', 'retour', 'annulee'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_state as enum ('non_paye', 'paye', 'partiel');
exception when duplicate_object then null; end $$;

do $$ begin
  create type expense_category as enum (
    'transport', 'loyer', 'salaires', 'marketing', 'fournitures', 'divers'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type financial_transaction_type as enum (
    'vente', 'encaissement', 'depense', 'achat', 'perte', 'retour', 'frais_livraison'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type cashflow_direction as enum ('entree', 'sortie');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cash_session_status as enum ('ouverte', 'cloturee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type poste_type as enum ('boutique', 'entrepot', 'mobile');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_status as enum ('assignee', 'en_livraison', 'livree', 'echec', 'retour');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Paramètres
-- ---------------------------------------------------------------------------
create table if not exists company_settings (
  id text primary key default 'company',
  name text not null,
  legal_name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  currency text not null default 'USD',
  default_delivery_fee numeric(12,2) not null default 0,
  low_stock_alert boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists postes (
  id text primary key,
  name text not null,
  address text not null default '',
  type poste_type not null default 'boutique',
  created_at timestamptz not null default now()
);

create table if not exists roles (
  code role_code primary key,
  label text not null,
  description text not null default '',
  enabled boolean not null default true
);

create table if not exists role_permissions (
  role_code role_code not null references roles(code) on delete cascade,
  permission text not null,
  primary key (role_code, permission)
);

-- ---------------------------------------------------------------------------
-- Utilisateurs
-- ---------------------------------------------------------------------------
create table if not exists users (
  id text primary key,
  full_name text not null,
  email text not null unique,
  phone text not null default '',
  role role_code not null references roles(code),
  status user_status not null default 'actif',
  poste_id text references postes(id) on delete set null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists user_permissions (
  user_id text not null references users(id) on delete cascade,
  permission text not null,
  primary key (user_id, permission)
);

create table if not exists audit_logs (
  id text primary key,
  user_id text references users(id) on delete set null,
  user_name text not null,
  action text not null,
  entity text not null,
  entity_id text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  title text not null,
  message text not null,
  level notification_level not null default 'info',
  read boolean not null default false,
  user_id text references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Géographie livraison (Kinshasa)
-- ---------------------------------------------------------------------------
create table if not exists communes (
  id text primary key,
  name text not null unique
);

create table if not exists delivery_zones (
  id text primary key,
  commune_id text not null references communes(id) on delete cascade,
  name text not null,
  default_fee numeric(12,2) not null default 0
);

create index if not exists delivery_zones_commune_idx on delivery_zones(commune_id);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id text primary key,
  name text not null,
  parent_id text references categories(id) on delete set null
);

create table if not exists brands (
  id text primary key,
  name text not null unique
);

create table if not exists suppliers (
  id text primary key,
  name text not null,
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  debt numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  name text not null,
  sku text not null unique,
  barcode text not null unique,
  custom_barcode text,
  category_id text not null references categories(id),
  brand_id text not null references brands(id),
  supplier_id text not null references suppliers(id),
  purchase_price numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  promo_price numeric(12,2),
  min_stock integer not null default 0,
  unit unit_code not null default 'pièce',
  description text not null default '',
  image_label text not null default '',
  lot_number text,
  expiry_date date,
  created_at timestamptz not null default now()
);

create table if not exists product_variants (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  sku text not null unique,
  barcode text not null unique,
  size text,
  color text,
  model text,
  stock integer not null default 0,
  reserved integer not null default 0,
  sold integer not null default 0
);

create index if not exists product_variants_product_idx on product_variants(product_id);
create index if not exists products_barcode_idx on products(barcode);
create index if not exists products_category_idx on products(category_id);

-- ---------------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------------
create table if not exists stock_movements (
  id text primary key,
  reference text not null,
  product_id text not null references products(id),
  variant_id text references product_variants(id) on delete set null,
  quantity integer not null,
  type stock_movement_type not null,
  user_id text references users(id) on delete set null,
  note text not null default '',
  from_poste_id text references postes(id) on delete set null,
  to_poste_id text references postes(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on stock_movements(product_id);
create index if not exists stock_movements_created_idx on stock_movements(created_at desc);

create table if not exists inventories (
  id text primary key,
  reference text not null unique,
  poste_id text references postes(id) on delete set null,
  status text not null default 'en_cours',
  user_id text references users(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists inventory_lines (
  id text primary key,
  inventory_id text not null references inventories(id) on delete cascade,
  product_id text not null references products(id),
  variant_id text references product_variants(id) on delete set null,
  expected_qty integer not null default 0,
  counted_qty integer not null default 0
);

create table if not exists stock_transfers (
  id text primary key,
  reference text not null unique,
  from_poste_id text not null references postes(id),
  to_poste_id text not null references postes(id),
  status text not null default 'brouillon',
  user_id text references users(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists stock_transfer_items (
  id text primary key,
  transfer_id text not null references stock_transfers(id) on delete cascade,
  product_id text not null references products(id),
  variant_id text references product_variants(id) on delete set null,
  quantity integer not null
);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table if not exists customers (
  id text primary key,
  full_name text not null,
  phone text not null,
  commune_id text not null references communes(id),
  zone_id text not null references delivery_zones(id),
  address text not null default '',
  notes text not null default '',
  total_spent numeric(12,2) not null default 0,
  orders_count integer not null default 0,
  regular boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customers_phone_idx on customers(phone);
create index if not exists customers_commune_idx on customers(commune_id);

-- ---------------------------------------------------------------------------
-- Livreurs
-- ---------------------------------------------------------------------------
create table if not exists delivery_drivers (
  id text primary key,
  user_id text not null unique references users(id) on delete cascade,
  full_name text not null,
  phone text not null default '',
  vehicle text not null default '',
  active boolean not null default true,
  can_sell boolean not null default false
);

create table if not exists delivery_driver_zones (
  driver_id text not null references delivery_drivers(id) on delete cascade,
  zone_id text not null references delivery_zones(id) on delete cascade,
  primary key (driver_id, zone_id)
);

-- ---------------------------------------------------------------------------
-- Commandes & livraisons
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id text primary key,
  reference text not null unique,
  customer_id text not null references customers(id),
  customer_name text not null,
  phone text not null,
  commune_id text not null references communes(id),
  zone_id text not null references delivery_zones(id),
  address_detail text not null default '',
  landmark text not null default '',
  products_total numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total_to_collect numeric(12,2) not null default 0,
  payment_state payment_state not null default 'non_paye',
  notes text not null default '',
  status order_status not null default 'nouvelle',
  driver_id text references delivery_drivers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists orders_status_idx on orders(status);
create index if not exists orders_driver_idx on orders(driver_id);
create index if not exists orders_created_idx on orders(created_at desc);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text not null references products(id),
  variant_id text references product_variants(id) on delete set null,
  product_name text not null,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  discount numeric(12,2) not null default 0
);

create table if not exists order_events (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  status order_status not null,
  note text not null default '',
  user_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists deliveries (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  driver_id text not null references delivery_drivers(id),
  status delivery_status not null,
  proof text,
  collected_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Achats fournisseurs
-- ---------------------------------------------------------------------------
create table if not exists purchase_orders (
  id text primary key,
  reference text not null unique,
  supplier_id text not null references suppliers(id),
  status purchase_order_status not null default 'brouillon',
  total numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists purchase_items (
  id text primary key,
  purchase_order_id text not null references purchase_orders(id) on delete cascade,
  product_id text not null references products(id),
  quantity integer not null,
  received integer not null default 0,
  unit_purchase_price numeric(12,2) not null
);

-- ---------------------------------------------------------------------------
-- Ventes POS
-- ---------------------------------------------------------------------------
create table if not exists sales (
  id text primary key,
  reference text not null unique,
  poste_id text not null references postes(id),
  user_id text references users(id) on delete set null,
  user_name text not null,
  customer_id text references customers(id) on delete set null,
  customer_name text not null default 'Client comptoir',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id text primary key,
  sale_id text not null references sales(id) on delete cascade,
  product_id text not null references products(id),
  variant_id text references product_variants(id) on delete set null,
  product_name text not null,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  discount numeric(12,2) not null default 0
);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
create table if not exists expenses (
  id text primary key,
  reference text not null unique,
  label text not null,
  category expense_category not null default 'divers',
  amount numeric(12,2) not null,
  user_id text references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists financial_transactions (
  id text primary key,
  reference text not null,
  type financial_transaction_type not null,
  label text not null,
  amount numeric(12,2) not null,
  direction cashflow_direction not null,
  created_at timestamptz not null default now()
);

create table if not exists cash_sessions (
  id text primary key,
  poste_id text not null references postes(id),
  opened_by text not null,
  opening_amount numeric(12,2) not null default 0,
  closing_amount numeric(12,2),
  expected_amount numeric(12,2) not null default 0,
  status cash_session_status not null default 'ouverte',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- RLS + grants (le rôle postgres contourne RLS ; policies pour l'API plus tard)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'company_settings','postes','roles','role_permissions','users','user_permissions',
      'audit_logs','notifications','communes','delivery_zones','categories','brands',
      'suppliers','products','product_variants','stock_movements','inventories',
      'inventory_lines','stock_transfers','stock_transfer_items','customers',
      'delivery_drivers','delivery_driver_zones','orders','order_items','order_events',
      'deliveries','purchase_orders','purchase_items','sales','sale_items','expenses',
      'financial_transactions','cash_sessions'
    ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists vsm_authenticated_all on %I', t);
    execute format(
      'create policy vsm_authenticated_all on %I for all to authenticated using (true) with check (true)',
      t
    );
    execute format('drop policy if exists vsm_service_all on %I', t);
    execute format(
      'create policy vsm_service_all on %I for all to service_role using (true) with check (true)',
      t
    );
  end loop;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;
