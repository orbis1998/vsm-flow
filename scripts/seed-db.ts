import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import {
  AUDIT_LOGS,
  BRANDS,
  CASH_SESSIONS,
  CATEGORIES,
  CUSTOMERS,
  DELIVERIES,
  DRIVERS,
  EXPENSES,
  MOVEMENTS,
  NOTIFICATIONS,
  ORDERS,
  PRODUCTS,
  PURCHASE_ORDERS,
  SALES,
  SUPPLIERS,
  TRANSACTIONS,
  USERS,
} from "../src/data/demo-seed.ts";

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

loadDotEnv();

async function insertRows(
  client: pg.Client,
  table: string,
  columns: string[],
  rows: unknown[][],
) {
  const chunk = 40;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params: unknown[] = [];
    const values = part.map((row, ri) => {
      const offs = ri * columns.length;
      for (const value of row) params.push(value);
      return `(${columns.map((_, ci) => `$${offs + ci + 1}`).join(",")})`;
    });
    await client.query(
      `insert into ${table} (${columns.join(",")}) values ${values.join(",")}`,
      params,
    );
  }
}

const client = new pg.Client({
  host: "aws-1-eu-west-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.mkksxwbchrfftsdyzmeq",
  password: process.env.PGPASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await client.connect();
console.log("Connecté. Insertion des données opérationnelles…");

try {
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
      users, suppliers, brands, categories
    restart identity cascade
  `);

  await insertRows(
    client,
    "users",
    ["id", "full_name", "email", "phone", "role", "status", "poste_id", "created_at", "last_login_at"],
    USERS.map((u) => [
      u.id,
      u.fullName,
      u.email,
      u.phone,
      u.role,
      u.status,
      u.posteId ?? null,
      u.createdAt,
      u.lastLoginAt ?? null,
    ]),
  );

  const extraPerms = USERS.flatMap((u) => u.extraPermissions.map((p) => [u.id, p]));
  if (extraPerms.length) {
    await insertRows(client, "user_permissions", ["user_id", "permission"], extraPerms);
  }

  await insertRows(
    client,
    "delivery_drivers",
    ["id", "user_id", "full_name", "phone", "vehicle", "active", "can_sell"],
    DRIVERS.map((d) => [d.id, d.userId, d.fullName, d.phone, d.vehicle, d.active, d.canSell]),
  );

  const driverZones = DRIVERS.flatMap((d) => d.zoneIds.map((z) => [d.id, z]));
  if (driverZones.length) {
    await insertRows(client, "delivery_driver_zones", ["driver_id", "zone_id"], driverZones);
  }

  await insertRows(
    client,
    "categories",
    ["id", "name", "parent_id"],
    CATEGORIES.map((c) => [c.id, c.name, c.parentId ?? null]),
  );
  await insertRows(
    client,
    "brands",
    ["id", "name"],
    BRANDS.map((b) => [b.id, b.name]),
  );
  await insertRows(
    client,
    "suppliers",
    ["id", "name", "contact_name", "phone", "email", "address", "debt", "created_at"],
    SUPPLIERS.map((s) => [s.id, s.name, s.contactName, s.phone, s.email, s.address, s.debt, s.createdAt]),
  );

  await insertRows(
    client,
    "products",
    [
      "id",
      "name",
      "sku",
      "barcode",
      "custom_barcode",
      "category_id",
      "brand_id",
      "supplier_id",
      "purchase_price",
      "sale_price",
      "promo_price",
      "min_stock",
      "unit",
      "description",
      "image_label",
      "lot_number",
      "expiry_date",
      "created_at",
    ],
    PRODUCTS.map((p) => [
      p.id,
      p.name,
      p.sku,
      p.barcode,
      p.customBarcode ?? null,
      p.categoryId,
      p.brandId,
      p.supplierId,
      p.purchasePrice,
      p.salePrice,
      p.promoPrice ?? null,
      p.minStock,
      p.unit,
      p.description,
      p.imageLabel,
      p.lotNumber ?? null,
      p.expiryDate ?? null,
      p.createdAt,
    ]),
  );

  const variants = PRODUCTS.flatMap((p) => p.variants);
  await insertRows(
    client,
    "product_variants",
    ["id", "product_id", "sku", "barcode", "size", "color", "model", "stock", "reserved", "sold"],
    variants.map((v) => [
      v.id,
      v.productId,
      v.sku,
      v.barcode,
      v.size ?? null,
      v.color ?? null,
      v.model ?? null,
      v.stock,
      v.reserved,
      v.sold,
    ]),
  );

  await insertRows(
    client,
    "customers",
    [
      "id",
      "full_name",
      "phone",
      "commune_id",
      "zone_id",
      "address",
      "notes",
      "total_spent",
      "orders_count",
      "regular",
      "created_at",
    ],
    CUSTOMERS.map((c) => [
      c.id,
      c.fullName,
      c.phone,
      c.communeId,
      c.zoneId,
      c.address,
      c.notes,
      c.totalSpent,
      c.ordersCount,
      c.regular,
      c.createdAt,
    ]),
  );

  await insertRows(
    client,
    "orders",
    [
      "id",
      "reference",
      "customer_id",
      "customer_name",
      "phone",
      "commune_id",
      "zone_id",
      "address_detail",
      "landmark",
      "products_total",
      "delivery_fee",
      "total_to_collect",
      "payment_state",
      "notes",
      "status",
      "driver_id",
      "created_at",
    ],
    ORDERS.map((o) => [
      o.id,
      o.reference,
      o.customerId,
      o.customerName,
      o.phone,
      o.communeId,
      o.zoneId,
      o.addressDetail,
      o.landmark,
      o.productsTotal,
      o.deliveryFee,
      o.totalToCollect,
      o.paymentState,
      o.notes,
      o.status,
      o.driverId ?? null,
      o.createdAt,
    ]),
  );

  const orderItems = ORDERS.flatMap((o) =>
    o.items.map((it) => [it.id, o.id, it.productId, it.variantId ?? null, it.productName, it.quantity, it.unitPrice, it.discount]),
  );
  await insertRows(
    client,
    "order_items",
    ["id", "order_id", "product_id", "variant_id", "product_name", "quantity", "unit_price", "discount"],
    orderItems,
  );

  const events = ORDERS.flatMap((o) =>
    o.history.map((e) => [e.id, o.id, e.status, e.note, e.userName, e.createdAt]),
  );
  await insertRows(
    client,
    "order_events",
    ["id", "order_id", "status", "note", "user_name", "created_at"],
    events,
  );

  await insertRows(
    client,
    "deliveries",
    ["id", "order_id", "driver_id", "status", "proof", "collected_amount", "created_at", "closed_at"],
    DELIVERIES.map((d) => [
      d.id,
      d.orderId,
      d.driverId,
      d.status,
      d.proof ?? null,
      d.collectedAmount,
      d.createdAt,
      d.closedAt ?? null,
    ]),
  );

  await insertRows(
    client,
    "purchase_orders",
    ["id", "reference", "supplier_id", "status", "total", "paid", "created_at", "received_at"],
    PURCHASE_ORDERS.map((p) => [
      p.id,
      p.reference,
      p.supplierId,
      p.status,
      p.total,
      p.paid,
      p.createdAt,
      p.receivedAt ?? null,
    ]),
  );

  const poItems = PURCHASE_ORDERS.flatMap((p) =>
    p.items.map((it) => [it.id, p.id, it.productId, it.quantity, it.received, it.unitPurchasePrice]),
  );
  await insertRows(
    client,
    "purchase_items",
    ["id", "purchase_order_id", "product_id", "quantity", "received", "unit_purchase_price"],
    poItems,
  );

  await insertRows(
    client,
    "sales",
    [
      "id",
      "reference",
      "poste_id",
      "user_id",
      "user_name",
      "customer_id",
      "customer_name",
      "subtotal",
      "discount",
      "total",
      "created_at",
    ],
    SALES.map((s) => [
      s.id,
      s.reference,
      s.posteId,
      s.userId,
      s.userName,
      s.customerId ?? null,
      s.customerName,
      s.subtotal,
      s.discount,
      s.total,
      s.createdAt,
    ]),
  );

  const saleItems = SALES.flatMap((s) =>
    s.items.map((it) => [it.id, s.id, it.productId, it.variantId ?? null, it.productName, it.quantity, it.unitPrice, it.discount]),
  );
  await insertRows(
    client,
    "sale_items",
    ["id", "sale_id", "product_id", "variant_id", "product_name", "quantity", "unit_price", "discount"],
    saleItems,
  );

  await insertRows(
    client,
    "stock_movements",
    ["id", "reference", "product_id", "variant_id", "quantity", "type", "user_id", "note", "created_at"],
    MOVEMENTS.map((m) => [
      m.id,
      m.reference,
      m.productId,
      m.variantId ?? null,
      m.quantity,
      m.type,
      m.userId,
      m.note,
      m.createdAt,
    ]),
  );

  await insertRows(
    client,
    "expenses",
    ["id", "reference", "label", "category", "amount", "user_id", "created_at"],
    EXPENSES.map((e) => [e.id, e.reference, e.label, e.category, e.amount, e.userId, e.createdAt]),
  );

  await insertRows(
    client,
    "financial_transactions",
    ["id", "reference", "type", "label", "amount", "direction", "created_at"],
    TRANSACTIONS.map((t) => [t.id, t.reference, t.type, t.label, t.amount, t.direction, t.createdAt]),
  );

  await insertRows(
    client,
    "cash_sessions",
    [
      "id",
      "poste_id",
      "opened_by",
      "opening_amount",
      "closing_amount",
      "expected_amount",
      "status",
      "opened_at",
      "closed_at",
    ],
    CASH_SESSIONS.map((c) => [
      c.id,
      c.posteId,
      c.openedBy,
      c.openingAmount,
      c.closingAmount ?? null,
      c.expectedAmount,
      c.status,
      c.openedAt,
      c.closedAt ?? null,
    ]),
  );

  await insertRows(
    client,
    "notifications",
    ["id", "title", "message", "level", "read", "created_at"],
    NOTIFICATIONS.map((n) => [n.id, n.title, n.message, n.level, n.read, n.createdAt]),
  );

  await insertRows(
    client,
    "audit_logs",
    ["id", "user_id", "user_name", "action", "entity", "entity_id", "created_at"],
    AUDIT_LOGS.map((l) => [l.id, l.userId, l.userName, l.action, l.entity, l.entityId ?? null, l.createdAt]),
  );

  await client.query("commit");
  console.log("OK — données opérationnelles insérées.");
  console.log({
    users: USERS.length,
    products: PRODUCTS.length,
    variants: variants.length,
    customers: CUSTOMERS.length,
    orders: ORDERS.length,
    sales: SALES.length,
    suppliers: SUPPLIERS.length,
    expenses: EXPENSES.length,
  });
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
