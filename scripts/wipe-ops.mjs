import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

function loadDotEnv(file = ".env") {
  const full = path.resolve(file);
  if (!fs.existsSync(full)) return;
  for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("base64");
  return `pbkdf2$100000$${salt}$${hash}`;
}

loadDotEnv();

const client = new pg.Client({
  host: "aws-1-eu-west-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.mkksxwbchrfftsdyzmeq",
  password: process.env.PGPASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

const adminPassword = process.env.ADMIN_PASSWORD || "Admin1234";
const schema = fs.readFileSync(path.resolve("supabase/migrations/003_auth_money.sql"), "utf8");

await client.connect();
console.log("Connecté. Nettoyage + admin…");

try {
  await client.query(schema);
  await client.query("begin");
  await client.query(`
    truncate table
      sale_items, sales,
      order_events, order_items, deliveries, orders,
      purchase_items, purchase_orders,
      stock_movements, product_variants, products,
      customers,
      delivery_driver_zones, delivery_drivers,
      user_permissions, audit_logs, notifications,
      financial_transactions, expenses, cash_sessions,
      users, suppliers, brands, categories, postes, push_subscriptions
    restart identity cascade
  `);

  await client.query(`update delivery_zones set default_fee = 0`);
  await client.query(`update roles set enabled = true`);
  await client.query(
    `update company_settings set
      name = 'Business Suite',
      legal_name = '',
      phone = '',
      email = '',
      address = '',
      currency = 'USD',
      default_delivery_fee = 0,
      usd_cdf_rate = 2800,
      low_stock_alert = true,
      updated_at = now()
     where id = 'company'`,
  );

  await client.query(
    `insert into categories (id, name) values ('cat-1', 'Général')
     on conflict (id) do update set name = excluded.name`,
  );
  await client.query(
    `insert into brands (id, name) values ('brd-1', 'Général')
     on conflict (id) do update set name = excluded.name`,
  );
  await client.query(
    `insert into suppliers (id, name, contact_name, phone, email, address, debt, created_at)
     values ('sup-1', 'À définir', '', '', '', '', 0, now())
     on conflict (id) do update set name = excluded.name`,
  );

  await client.query(
    `insert into users (id, full_name, email, phone, badge, password_hash, role, status, created_at)
     values ($1,$2,$3,$4,$5,$6,'ADMIN','actif', now())`,
    [
      "usr-admin",
      "Administrateur",
      "admin@local",
      "",
      "admin",
      hashPassword(adminPassword),
    ],
  );

  await client.query("commit");
  console.log("OK — données fictives supprimées.");
  console.log("Compte admin : badge « admin » / mot de passe :", adminPassword);
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    // ignore
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
