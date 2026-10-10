import type { PoolClient } from "pg";
import { nextId } from "@/lib/app-state";
import { GRANTABLE_PERMISSIONS, hasPermission } from "@/lib/roles";
import { hashPassword } from "./password";
import type {
  CompanySettings,
  Customer,
  Expense,
  ID,
  Order,
  OrderItem,
  OrderStatus,
  Permission,
  Poste,
  Product,
  RoleCode,
  Sale,
  SaleItem,
  SaleKind,
  StockMovementType,
  Supplier,
  User,
  Commune,
  DeliveryZone,
} from "@/types";

type Client = PoolClient;

export async function actor(client: Client): Promise<{ id: string; fullName: string }> {
  const admin = await client.query(
    "select id, full_name from users where role = 'ADMIN' and status = 'actif' order by created_at limit 1",
  );
  const row = admin.rows[0];
  if (row) return { id: String(row.id), fullName: String(row.full_name) };
  const any = await client.query("select id, full_name from users order by created_at limit 1");
  const fallback = any.rows[0];
  if (fallback) return { id: String(fallback.id), fullName: String(fallback.full_name) };
  return { id: "system", fullName: "Système" };
}

export async function audit(
  client: Client,
  action: string,
  entity: string,
  entityId?: string,
): Promise<void> {
  const who = await actor(client);
  await client.query(
    `insert into audit_logs (id, user_id, user_name, action, entity, entity_id, created_at)
     values ($1,$2,$3,$4,$5,$6, now())`,
    [nextId("log"), who.id, who.fullName, action, entity, entityId ?? null],
  );
}

function nowIso() {
  return new Date().toISOString();
}

const GRANTABLE = new Set(GRANTABLE_PERMISSIONS.map((g) => g.perm));

function sanitizeExtras(perms: Permission[] | undefined): Permission[] {
  return [...new Set((perms ?? []).filter((p) => GRANTABLE.has(p)))];
}

async function adjustVariantStock(
  client: Client,
  variantId: ID | undefined,
  productId: ID,
  quantity: number,
  type: StockMovementType,
  whoId: string,
  note: string,
  reference: string,
): Promise<void> {
  if (!variantId || quantity === 0) return;
  const delta = type === "entree" ? Math.abs(quantity) : -Math.abs(quantity);
  const soldDelta = type === "entree" ? -Math.abs(quantity) : Math.abs(quantity);
  await client.query(
    "update product_variants set stock = greatest(0, stock + $2), sold = greatest(0, sold + $3) where id = $1",
    [variantId, delta, soldDelta],
  );
  await client.query(
    `insert into stock_movements (id, reference, product_id, variant_id, quantity, type, user_id, note, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now())`,
    [nextId("mvt"), reference, productId, variantId, delta, type, whoId, note],
  );
}

async function pingManagers(
  _client: Client,
  payload: { title: string; message: string; level?: "info" | "alerte" | "critique"; href?: string },
): Promise<void> {
  const { queueManagerPing } = await import("./db");
  queueManagerPing(payload);
}

function asUserId(value: unknown): string | undefined {
  if (value == null) return undefined;
  const id = String(value).trim();
  if (!id || id === "null" || id === "undefined") return undefined;
  return id;
}

async function pingUsers(
  userIds: Array<string | undefined | null>,
  payload: { title: string; message: string; level?: "info" | "alerte" | "critique"; href?: string },
): Promise<void> {
  const ids = [...new Set(userIds.map(asUserId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  const { queueManagerPing } = await import("./db");
  queueManagerPing({ ...payload, userIds: ids });
}

async function livreurUserIds(client: Client): Promise<string[]> {
  const res = await client.query(
    `select u.id
     from users u
     where u.status = 'actif' and u.role = 'LIVREUR'
       and exists (
         select 1 from delivery_drivers d
         where d.user_id = u.id and coalesce(d.active, true)
       )`,
  );
  return res.rows.map((r) => String(r.id)).filter((id) => asUserId(id));
}

export async function pingDriverLocation(
  client: Client,
  input: { userId: string; lat: number; lng: number; heading?: number; accuracy?: number },
): Promise<void> {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!input.userId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
  const driver = await client.query("select id from delivery_drivers where user_id = $1", [input.userId]);
  if (!driver.rows[0]) return;
  const heading = Number(input.heading);
  const accuracy = Number(input.accuracy);
  const driverId = String(driver.rows[0].id);
  await client.query(
    `update delivery_drivers set
      last_lat = $2, last_lng = $3,
      last_heading = $4, last_accuracy = $5, last_seen_at = now()
     where id = $1`,
    [
      driverId,
      lat,
      lng,
      Number.isFinite(heading) ? heading : null,
      Number.isFinite(accuracy) ? accuracy : null,
    ],
  );
  try {
    const { ensureDriverTrail } = await import("./db");
    await ensureDriverTrail(client);
    await client.query(
      `insert into driver_positions (id, driver_id, lat, lng, heading, recorded_at)
       values ($1,$2,$3,$4,$5, now())`,
      [nextId("dpt"), driverId, lat, lng, Number.isFinite(heading) ? heading : null],
    );
    await client.query(
      `delete from driver_positions
       where driver_id = $1
         and id not in (
           select id from driver_positions
           where driver_id = $1
           order by recorded_at desc
           limit 80
         )`,
      [driverId],
    );
  } catch {
    // la position instantanée reste même si la trace échoue
  }
}

const DELIVERY_STATUSES = new Set(["assignee", "en_livraison", "livree", "echec", "retour"]);

async function syncDeliveryRow(
  client: Client,
  orderId: ID,
  driverId: string | null | undefined,
  status: OrderStatus,
  collected: number,
): Promise<void> {
  if (!driverId || !DELIVERY_STATUSES.has(status)) return;
  const closed = ["livree", "echec", "retour"].includes(status);
  const existing = await client.query(
    "select id from deliveries where order_id = $1 order by created_at desc limit 1",
    [orderId],
  );
  if (existing.rows[0]) {
    await client.query(
      "update deliveries set driver_id = $2, status = $3, collected_amount = $4, closed_at = $5 where id = $1",
      [existing.rows[0].id, driverId, status, collected, closed ? new Date().toISOString() : null],
    );
    return;
  }
  await client.query(
    `insert into deliveries (id, order_id, driver_id, status, collected_amount, created_at, closed_at)
     values ($1,$2,$3,$4,$5, now(), $6)`,
    [nextId("dlv"), orderId, driverId, status, collected, closed ? new Date().toISOString() : null],
  );
}

/* --------------------------------- Produits -------------------------------- */

export type ProductCreateInput = Omit<Product, "id" | "createdAt" | "variants"> & {
  variants?: Product["variants"];
};

export async function createProduct(client: Client, input: ProductCreateInput): Promise<Product> {
  const id = nextId("prd");
  const createdAt = nowIso();
  const variants = (input.variants ?? []).map((v, i) => ({
    ...v,
    id: `${id}-v${i + 1}`,
    productId: id,
  }));
  await client.query(
    `insert into products (
      id, name, sku, barcode, custom_barcode, category_id, brand_id, supplier_id,
      purchase_price, sale_price, promo_price, min_stock, unit, description, image_label, image_url,
      lot_number, expiry_date, options, created_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)`,
    [
      id,
      input.name,
      input.sku,
      input.barcode,
      input.customBarcode ?? null,
      input.categoryId,
      input.brandId,
      input.supplierId,
      input.purchasePrice,
      input.salePrice,
      input.promoPrice ?? null,
      input.minStock,
      input.unit,
      input.description,
      input.imageLabel,
      input.imageUrl ?? "",
      input.lotNumber ?? null,
      input.expiryDate ?? null,
      JSON.stringify(input.options ?? []),
      createdAt,
    ],
  );
  for (const v of variants) {
    await client.query(
      `insert into product_variants (id, product_id, sku, barcode, size, color, model, stock, reserved, sold, options)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        v.id,
        id,
        v.sku,
        v.barcode,
        v.size ?? v.options?.Taille ?? null,
        v.color ?? v.options?.Couleur ?? null,
        v.model ?? v.options?.["Modèle"] ?? null,
        v.stock,
        v.reserved,
        v.sold,
        JSON.stringify(v.options ?? {}),
      ],
    );
  }
  await audit(client, "Création produit", "Product", input.sku);
  return { ...input, id, variants, createdAt };
}

export async function updateProduct(client: Client, id: ID, patch: Partial<Product>): Promise<void> {
  const current = await client.query("select * from products where id = $1", [id]);
  if (!current.rows[0]) return;
  const row = current.rows[0];
  await client.query(
    `update products set
      name = $2, sku = $3, barcode = $4, custom_barcode = $5, category_id = $6, brand_id = $7,
      supplier_id = $8, purchase_price = $9, sale_price = $10, promo_price = $11, min_stock = $12,
      unit = $13, description = $14, image_label = $15, image_url = $16, lot_number = $17, expiry_date = $18
     where id = $1`,
    [
      id,
      patch.name ?? row.name,
      patch.sku ?? row.sku,
      patch.barcode ?? row.barcode,
      patch.customBarcode !== undefined ? (patch.customBarcode ?? null) : row.custom_barcode,
      patch.categoryId ?? row.category_id,
      patch.brandId ?? row.brand_id,
      patch.supplierId ?? row.supplier_id,
      patch.purchasePrice ?? row.purchase_price,
      patch.salePrice ?? row.sale_price,
      patch.promoPrice !== undefined ? (patch.promoPrice ?? null) : row.promo_price,
      patch.minStock ?? row.min_stock,
      patch.unit ?? row.unit,
      patch.description ?? row.description,
      patch.imageLabel ?? row.image_label,
      patch.imageUrl !== undefined ? (patch.imageUrl ?? "") : (row.image_url ?? ""),
      patch.lotNumber !== undefined ? (patch.lotNumber ?? null) : row.lot_number,
      patch.expiryDate !== undefined ? (patch.expiryDate ?? null) : row.expiry_date,
    ],
  );
  if (patch.variants) {
    await client.query("delete from product_variants where product_id = $1", [id]);
    for (const [i, v] of patch.variants.entries()) {
      const vid = v.id || `${id}-v${i + 1}`;
      await client.query(
        `insert into product_variants (id, product_id, sku, barcode, size, color, model, stock, reserved, sold, options)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          vid,
          id,
          v.sku,
          v.barcode,
          v.size ?? v.options?.Taille ?? null,
          v.color ?? v.options?.Couleur ?? null,
          v.model ?? v.options?.["Modèle"] ?? null,
          v.stock,
          v.reserved,
          v.sold,
          JSON.stringify(v.options ?? {}),
        ],
      );
    }
  }
  await audit(client, "Modification produit", "Product", id);
}

export async function removeProduct(client: Client, id: ID): Promise<void> {
  const used = await client.query("select count(*)::int as n from order_items where product_id = $1", [id]);
  if (Number(used.rows[0]?.n ?? 0) > 0) {
    throw new Error("Impossible de supprimer : l'article est déjà dans des commandes. Vous pouvez le modifier.");
  }
  await client.query("delete from stock_movements where product_id = $1", [id]);
  await client.query("delete from product_variants where product_id = $1", [id]);
  await client.query("delete from products where id = $1", [id]);
  await audit(client, "Suppression produit", "Product", id);
}

/* ---------------------------------- Stock ---------------------------------- */

export async function addMovement(
  client: Client,
  input: { productId: ID; variantId?: ID; quantity: number; type: StockMovementType; note: string },
): Promise<void> {
  const who = await actor(client);
  const id = nextId("mvt");
  const reference = `MVT-${Math.floor(Math.random() * 9000) + 1000}`;
  await client.query(
    `insert into stock_movements (id, reference, product_id, variant_id, quantity, type, user_id, note, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now())`,
    [id, reference, input.productId, input.variantId ?? null, input.quantity, input.type, who.id, input.note],
  );

  const variants = await client.query(
    "select id, stock from product_variants where product_id = $1 order by sku",
    [input.productId],
  );
  const target =
    (input.variantId ? variants.rows.find((v) => String(v.id) === input.variantId) : variants.rows[0]) ??
    null;
  if (target) {
    await client.query("update product_variants set stock = greatest(0, stock + $2) where id = $1", [
      target.id,
      input.quantity,
    ]);
  }
  await audit(client, "Mouvement de stock", "StockMovement", reference);
}

export async function restockDriver(
  client: Client,
  input: { driverId: ID; productId: ID; variantId?: ID; quantity: number },
): Promise<void> {
  const qty = Math.max(1, Math.round(Number(input.quantity) || 0));
  if (!input.driverId) throw new Error("Choisissez un livreur.");
  if (!input.productId) throw new Error("Choisissez un article.");
  if (qty < 1) throw new Error("Quantité invalide.");

  try {
    const { ensureDriverStock } = await import("./db");
    await ensureDriverStock(client);
  } catch {
    // la table peut déjà exister
  }

  const who = await actor(client);
  const driver = await resolveDriver(client, input.driverId);
  const driverUser = await client.query("select role from users where id = $1", [driver.userId]);
  const extras = await client.query("select permission from user_permissions where user_id = $1", [driver.userId]);
  const role = String(driverUser.rows[0]?.role ?? "LIVREUR") as RoleCode;
  const extraPerms = extras.rows.map((r) => String(r.permission)) as Permission[];
  if (!hasPermission(role, extraPerms, "driver.stock")) {
    throw new Error("Ce livreur n'est pas autorisé à porter un stock. Activez la permission dans Équipe.");
  }
  const product = await client.query("select id, name from products where id = $1", [input.productId]);
  if (!product.rows[0]) throw new Error("Article introuvable.");

  const variants = await client.query(
    "select id, stock, sku from product_variants where product_id = $1 order by stock desc, sku",
    [input.productId],
  );
  if (!variants.rows.length) {
    throw new Error("Cet article n'a pas de variante. Ajoutez une taille ou un modèle dans Articles.");
  }
  const wanted = input.variantId ? String(input.variantId) : "";
  const target =
    variants.rows.find((v) => wanted && String(v.id) === wanted) ??
    variants.rows.find((v) => Number(v.stock ?? 0) >= qty) ??
    variants.rows[0];
  const available = Number(target.stock ?? 0);
  if (available < qty) {
    throw new Error(`${product.rows[0].name} : stock boutique insuffisant (${available} restant).`);
  }

  const userRow = await client.query("select poste_id from users where id = $1", [driver.userId]);
  const posteId = userRow.rows[0]?.poste_id ? String(userRow.rows[0].poste_id) : null;
  let posteName = "sans boutique";
  if (posteId) {
    const poste = await client.query("select name from postes where id = $1", [posteId]);
    if (poste.rows[0]) posteName = String(poste.rows[0].name);
  }

  const deducted = await client.query(
    "update product_variants set stock = stock - $2 where id = $1 and stock >= $2 returning stock",
    [target.id, qty],
  );
  if (!deducted.rows[0]) {
    throw new Error(`${product.rows[0].name} : stock boutique insuffisant.`);
  }

  const reference = `DOT-${Math.floor(Math.random() * 9000) + 1000}`;
  await client.query(
    `insert into stock_movements (id, reference, product_id, variant_id, quantity, type, user_id, note, created_at)
     values ($1,$2,$3,$4,$5,'sortie',$6,$7, now())`,
    [
      nextId("mvt"),
      reference,
      input.productId,
      String(target.id),
      -qty,
      who.id,
      `Dotation ${driver.fullName} · ${posteName}`,
    ],
  );

  const existing = await client.query(
    `select id from driver_stock
     where driver_id = $1 and product_id = $2
       and coalesce(variant_id, '') = coalesce($3, '')`,
    [driver.id, input.productId, String(target.id)],
  );
  if (existing.rows[0]) {
    await client.query(
      "update driver_stock set quantity = quantity + $2, updated_at = now() where id = $1",
      [existing.rows[0].id, qty],
    );
  } else {
    await client.query(
      `insert into driver_stock (id, driver_id, product_id, variant_id, quantity, updated_at)
       values ($1,$2,$3,$4,$5, now())`,
      [nextId("dst"), driver.id, input.productId, String(target.id), qty],
    );
  }

  await audit(client, "Dotation stock livreur", "DriverStock", driver.id);
  await pingUsers([driver.userId], {
    title: "Stock reçu",
    message: `${qty} × ${product.rows[0].name} · ${posteName}`,
    href: "/stock",
  });
}

async function consumeDriverStock(
  client: Client,
  driverId: string,
  productId: string,
  variantId: string | undefined,
  quantity: number,
): Promise<number> {
  if (quantity <= 0) return 0;
  const row = await client.query(
    `select id, quantity from driver_stock
     where driver_id = $1 and product_id = $2
       and coalesce(variant_id, '') = coalesce($3, '')`,
    [driverId, productId, variantId ?? ""],
  );
  if (!row.rows[0]) return quantity;
  const have = Number(row.rows[0].quantity ?? 0);
  const take = Math.min(have, quantity);
  if (take <= 0) return quantity;
  await client.query("update driver_stock set quantity = greatest(0, quantity - $2), updated_at = now() where id = $1", [
    row.rows[0].id,
    take,
  ]);
  return quantity - take;
}

async function creditDriverStock(
  client: Client,
  driverId: string,
  productId: string,
  variantId: string | undefined,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;
  const existing = await client.query(
    `select id from driver_stock
     where driver_id = $1 and product_id = $2
       and coalesce(variant_id, '') = coalesce($3, '')`,
    [driverId, productId, variantId ?? ""],
  );
  if (existing.rows[0]) {
    await client.query(
      "update driver_stock set quantity = quantity + $2, updated_at = now() where id = $1",
      [existing.rows[0].id, quantity],
    );
    return;
  }
  await client.query(
    `insert into driver_stock (id, driver_id, product_id, variant_id, quantity, updated_at)
     values ($1,$2,$3,$4,$5, now())`,
    [nextId("dst"), driverId, productId, variantId ?? null, quantity],
  );
}

async function consumeDriverStockFlexible(
  client: Client,
  driverId: string,
  productId: string,
  variantId: string | undefined,
  quantity: number,
): Promise<number> {
  let leftover = await consumeDriverStock(client, driverId, productId, variantId, quantity);
  if (leftover > 0 && variantId) {
    leftover = await consumeDriverStock(client, driverId, productId, undefined, leftover);
  }
  if (leftover > 0) {
    const others = await client.query(
      `select variant_id from driver_stock
       where driver_id = $1 and product_id = $2 and quantity > 0
       order by quantity desc`,
      [driverId, productId],
    );
    for (const row of others.rows) {
      if (leftover <= 0) break;
      leftover = await consumeDriverStock(
        client,
        driverId,
        productId,
        row.variant_id ? String(row.variant_id) : undefined,
        leftover,
      );
    }
  }
  return leftover;
}

function stockAlreadyHeld(items: Array<{ from_driver?: unknown }>): boolean {
  return items.some((it) => it.from_driver != null);
}

async function driverOnHand(client: Client, driverId: string, productId: string): Promise<number> {
  const res = await client.query(
    `select coalesce(sum(quantity), 0) as n from driver_stock
     where driver_id = $1 and product_id = $2`,
    [driverId, productId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

async function boutiqueOnHand(client: Client, variantId: string | undefined): Promise<number> {
  if (!variantId) return 0;
  const stock = await client.query("select stock from product_variants where id = $1", [variantId]);
  return Number(stock.rows[0]?.stock ?? 0);
}

async function assertCanFulfill(
  client: Client,
  items: Array<{ productId: string; variantId?: string; productName: string; quantity: number }>,
  driverId?: string | null,
): Promise<void> {
  const bagUsed: Record<string, number> = {};
  for (const it of items) {
    const boutique = await boutiqueOnHand(client, it.variantId);
    const bag = driverId ? await driverOnHand(client, driverId, it.productId) : 0;
    const driverLeft = Math.max(0, bag - (bagUsed[it.productId] ?? 0));
    const fromDriver = Math.min(driverLeft, it.quantity);
    const needBoutique = it.quantity - fromDriver;
    if (needBoutique > boutique) {
      throw new Error(
        driverId
          ? `${it.productName} : stock insuffisant (livreur ${driverLeft}, boutique ${boutique}, demandé ${it.quantity}).`
          : `${it.productName} : stock insuffisant (${boutique} restant).`,
      );
    }
    bagUsed[it.productId] = (bagUsed[it.productId] ?? 0) + fromDriver;
  }
}

async function takeDriverOrderItems(
  client: Client,
  driverId: string,
  items: Array<{
    id?: unknown;
    product_id: unknown;
    variant_id: unknown;
    quantity: unknown;
    product_name?: unknown;
  }>,
  whoId: string,
  reference: string,
): Promise<void> {
  for (const it of items) {
    const qty = Number(it.quantity);
    const productId = String(it.product_id);
    const variantId = it.variant_id ? String(it.variant_id) : undefined;
    const name = String(it.product_name || "Article");
    const leftover = await consumeDriverStockFlexible(client, driverId, productId, variantId, qty);
    const fromDriver = qty - leftover;
    if (leftover > 0) {
      if (!variantId) throw new Error(`Stock indisponible pour ${name}`);
      const stock = await client.query("select stock from product_variants where id = $1", [variantId]);
      const available = Number(stock.rows[0]?.stock ?? 0);
      if (available < leftover) {
        throw new Error(
          `${name} : stock insuffisant (livreur ${fromDriver}, boutique ${available}, demandé ${qty}).`,
        );
      }
      await adjustVariantStock(
        client,
        variantId,
        productId,
        leftover,
        "sortie",
        whoId,
        `Commande ${reference} · reliquat boutique`,
        reference,
      );
    }
    if (it.id) {
      await client.query("update order_items set from_driver = $2 where id = $1", [it.id, fromDriver]);
    }
  }
}

async function restoreDriverOrderItems(
  client: Client,
  driverId: string,
  items: Array<{
    product_id: unknown;
    variant_id: unknown;
    quantity: unknown;
    from_driver?: unknown;
  }>,
  whoId?: string,
  reference?: string,
): Promise<void> {
  for (const it of items) {
    const qty = Number(it.quantity);
    const productId = String(it.product_id);
    const variantId = it.variant_id ? String(it.variant_id) : undefined;
    const recorded = it.from_driver;
    if (recorded == null) {
      await creditDriverStock(client, driverId, productId, variantId, qty);
      continue;
    }
    const fromDriver = Number(recorded) || 0;
    if (fromDriver > 0) {
      await creditDriverStock(client, driverId, productId, variantId, fromDriver);
    }
    const boutique = qty - fromDriver;
    if (boutique > 0 && whoId && reference) {
      await adjustVariantStock(
        client,
        variantId,
        productId,
        boutique,
        "entree",
        whoId,
        `Retour ${reference}`,
        reference,
      );
    }
  }
}

/* -------------------------------- Commandes -------------------------------- */

export type OrderCreateInput = {
  customerId?: ID;
  customerName: string;
  phone: string;
  communeId: ID;
  zoneId: ID;
  addressDetail: string;
  landmark: string;
  notes: string;
  deliveryFee: number;
  items: Array<Omit<OrderItem, "id">>;
  driverId?: ID;
  posteId?: ID;
  dueAt?: string;
};

export async function createOrder(client: Client, input: OrderCreateInput): Promise<Order> {
  const who = await actor(client);
  if (!input.items.length) throw new Error("Ajoutez au moins un article.");
  if (!input.communeId || !input.zoneId) throw new Error("Choisissez une commune et un quartier.");
  const commune = await client.query("select id from communes where id = $1", [input.communeId]);
  if (!commune.rows[0]) throw new Error("Commune introuvable.");
  const zone = await client.query(
    "select id from delivery_zones where id = $1 and commune_id = $2",
    [input.zoneId, input.communeId],
  );
  if (!zone.rows[0]) throw new Error("Quartier introuvable pour cette commune.");
  let customerId: string | null = input.customerId || null;
  if (customerId) {
    const found = await client.query("select id from customers where id = $1", [customerId]);
    if (!found.rows[0]) customerId = null;
  }
  const assigned = input.driverId ? await resolveDriver(client, input.driverId) : null;
  await assertCanFulfill(
    client,
    input.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      productName: it.productName,
      quantity: Math.max(1, Math.round(Number(it.quantity) || 0)),
    })),
    assigned?.id,
  );
  const id = nextId("ord");
  const createdAt = nowIso();
  const items: OrderItem[] = input.items.map((it, i) => ({
    ...it,
    id: nextId(`oit${i}`),
    quantity: Math.max(1, Math.round(Number(it.quantity) || 0)),
    unitPrice: Number(it.unitPrice) || 0,
    discount: Number(it.discount) || 0,
  }));
  const productsTotal = Math.round(items.reduce((s, it) => s + it.unitPrice * it.quantity - it.discount, 0) * 100) / 100;
  const totalToCollect = productsTotal;
  const reference = `CMD-${new Date().getFullYear()}-${id.replace(/\W/g, "").slice(-8).toUpperCase()}`;
  const evtId = nextId("evt");
  const customerName = (input.customerName ?? "").trim() || "Client";
  const status: OrderStatus = assigned ? "assignee" : "nouvelle";
  const createdNote = assigned ? `Commande enregistrée · ${assigned.fullName}` : "Commande enregistrée";
  const deliveryFee = Number(input.deliveryFee) || 0;

  await client.query(
    `insert into orders (
      id, reference, customer_id, customer_name, phone, commune_id, zone_id, address_detail, landmark,
      products_total, delivery_fee, total_to_collect, payment_state, notes, status, received_usd, received_cdf, created_at, driver_id, poste_id, due_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'non_paye',$13,$14,0,0,now(),$15,$16,$17)`,
    [
      id,
      reference,
      customerId,
      customerName,
      input.phone || "",
      input.communeId,
      input.zoneId,
      input.addressDetail || "",
      input.landmark || "",
      productsTotal,
      deliveryFee,
      totalToCollect,
      input.notes || "",
      status,
      assigned?.id ?? null,
      input.posteId || null,
      input.dueAt || null,
    ],
  );
  for (const it of items) {
    await client.query(
      `insert into order_items (id, order_id, product_id, variant_id, product_name, quantity, unit_price, discount)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [it.id, id, it.productId, it.variantId ?? null, it.productName, it.quantity, it.unitPrice, it.discount],
    );
  }
  await client.query(
    `insert into order_events (id, order_id, status, note, user_name, created_at)
     values ($1,$2,$3,$4,$5,$6)`,
    [evtId, id, status, createdNote, who.fullName, createdAt],
  );
  await audit(client, "Création commande", "Order", reference);
  const ping = {
    title: `Nouvelle commande ${reference}`,
    message: `${customerName}${assigned ? ` · ${assigned.fullName}` : ""}`,
  };
  await pingManagers(client, { ...ping, href: "/commandes" });
  if (assigned) {
    await pingUsers([assigned.userId], {
      title: `Course assignée ${reference}`,
      message: `${customerName} — à livrer`,
      href: "/livreur",
    });
  } else {
    await pingUsers(await livreurUserIds(client), {
      title: `Nouvelle commande ${reference}`,
      message: `${customerName} — non assignée`,
      href: "/livreur",
    });
  }
  return {
    id,
    reference,
    customerName,
    phone: input.phone,
    communeId: input.communeId,
    zoneId: input.zoneId,
    addressDetail: input.addressDetail,
    landmark: input.landmark,
    items,
    productsTotal,
    deliveryFee,
    totalToCollect,
    paymentState: "non_paye",
    notes: input.notes,
    status,
    receivedUsd: 0,
    receivedCdf: 0,
    createdAt,
    history: [{ id: evtId, status, note: createdNote, userName: who.fullName, createdAt }],
    ...(customerId ? { customerId } : {}),
    ...(assigned ? { driverId: assigned.id } : {}),
    ...(input.posteId ? { posteId: input.posteId } : {}),
    ...(input.dueAt ? { dueAt: input.dueAt } : {}),
  };
}

export async function updateOrderStatus(
  client: Client,
  id: ID,
  status: OrderStatus,
  note: string,
  received?: { receivedUsd?: number; receivedCdf?: number },
): Promise<void> {
  const who = await actor(client);
  const current = await client.query("select * from orders where id = $1", [id]);
  const order = current.rows[0];
  if (!order) throw new Error("Commande introuvable.");
  const receivedUsd = received?.receivedUsd ?? Number(order.received_usd ?? 0);
  const receivedCdf = received?.receivedCdf ?? Number(order.received_cdf ?? 0);
  const paymentState = status === "livree" ? "paye" : order.payment_state;
  if (status === "livree" && order.status !== "livree") {
    const items = await client.query("select * from order_items where order_id = $1", [id]);
    if (!stockAlreadyHeld(items.rows)) {
      if (order.driver_id) {
        await takeDriverOrderItems(
          client,
          String(order.driver_id),
          items.rows.map((it) => ({
            id: it.id,
            product_id: it.product_id,
            variant_id: it.variant_id,
            quantity: it.quantity,
            product_name: it.product_name,
          })),
          who.id,
          String(order.reference),
        );
      } else {
        for (const it of items.rows) {
          await adjustVariantStock(
            client,
            it.variant_id ? String(it.variant_id) : undefined,
            String(it.product_id),
            Number(it.quantity),
            "sortie",
            who.id,
            `Livraison ${order.reference}`,
            String(order.reference),
          );
        }
      }
    }
  }
  const deliveredAt =
    status === "livree"
      ? (order.delivered_at ?? new Date().toISOString())
      : String(order.status) === "livree"
        ? null
        : (order.delivered_at ?? null);
  try {
    await client.query(
      "update orders set status = $2, payment_state = $3, received_usd = $4, received_cdf = $5, delivered_at = $6 where id = $1",
      [id, status, paymentState, receivedUsd, receivedCdf, deliveredAt],
    );
  } catch {
    await client.query(
      "update orders set status = $2, payment_state = $3, received_usd = $4, received_cdf = $5 where id = $1",
      [id, status, paymentState, receivedUsd, receivedCdf],
    );
  }
  await client.query(
    `insert into order_events (id, order_id, status, note, user_name, created_at)
     values ($1,$2,$3,$4,$5, now())`,
    [nextId("evt"), id, status, note, who.fullName],
  );
  if (status === "livree" && order.status !== "livree") {
    try {
      await client.query(
        `insert into financial_transactions (id, reference, type, label, amount, direction, created_at)
         values ($1,$2,'encaissement',$3,$4,'entree', now())`,
        [
          nextId("trx"),
          `${order.reference}-${nextId("enc")}`,
          `Encaissement livraison — ${order.customer_name}`,
          Number(order.products_total) || 0,
        ],
      );
    } catch {
      // l'encaissement ne doit pas annuler la livraison
    }
  }
  await syncDeliveryRow(
    client,
    id,
    order.driver_id ? String(order.driver_id) : null,
    status,
    Number(order.products_total) || 0,
  );
  await audit(client, "Changement de statut commande", "Order", id);
  const labels: Record<string, string> = {
    en_livraison: "en route",
    livree: "livrée",
    echec: "en échec",
  };
  if ((status === "annulee" || status === "retour") && !["annulee", "retour"].includes(String(order.status))) {
    const held = await client.query("select * from order_items where order_id = $1", [id]);
    const driverId = order.driver_id ? String(order.driver_id) : null;
    const wasDelivered = String(order.status) === "livree";
    if (driverId && (wasDelivered || stockAlreadyHeld(held.rows))) {
      await restoreDriverOrderItems(client, driverId, held.rows, who.id, String(order.reference));
    } else if (wasDelivered) {
      for (const it of held.rows) {
        await adjustVariantStock(
          client,
          it.variant_id ? String(it.variant_id) : undefined,
          String(it.product_id),
          Number(it.quantity),
          "entree",
          who.id,
          `Retour ${order.reference}`,
          String(order.reference),
        );
      }
    }
  }
  if (labels[status]) {
    await pingManagers(client, {
      title: `Commande ${order.reference} ${labels[status]}`,
      message: `${order.customer_name} · ${who.fullName}`,
      level: status === "echec" ? "alerte" : "info",
      href: "/commandes",
    });
  }
}

async function resolveDriver(
  client: Client,
  driverId: ID,
): Promise<{ id: string; fullName: string; userId: string }> {
  const byId = await client.query("select id, full_name, user_id from delivery_drivers where id = $1", [driverId]);
  if (byId.rows[0]) {
    return {
      id: String(byId.rows[0].id),
      fullName: String(byId.rows[0].full_name),
      userId: asUserId(byId.rows[0].user_id) ?? "",
    };
  }
  const byUser = await client.query("select id, full_name, user_id from delivery_drivers where user_id = $1", [driverId]);
  if (byUser.rows[0]) {
    return {
      id: String(byUser.rows[0].id),
      fullName: String(byUser.rows[0].full_name),
      userId: asUserId(byUser.rows[0].user_id) ?? "",
    };
  }
  const user = await client.query(
    "select id, full_name, coalesce(phone, '') as phone from users where id = $1 and role = 'LIVREUR'",
    [driverId],
  );
  if (user.rows[0]) {
    await client.query(
      `insert into delivery_drivers (id, user_id, full_name, phone, vehicle, active, can_sell)
       values ($1,$2,$3,$4,'Moto',true,false)
       on conflict (user_id) do update set full_name = excluded.full_name, phone = excluded.phone, active = true`,
      [nextId("drv"), user.rows[0].id, user.rows[0].full_name, user.rows[0].phone],
    );
    const again = await client.query("select id, full_name, user_id from delivery_drivers where user_id = $1", [
      user.rows[0].id,
    ]);
    if (again.rows[0]) {
      return {
        id: String(again.rows[0].id),
        fullName: String(again.rows[0].full_name),
        userId: asUserId(again.rows[0].user_id) ?? String(user.rows[0].id),
      };
    }
  }
  throw new Error("Livreur introuvable. Créez un compte rôle Livreur dans Équipe.");
}

export async function assignDriver(client: Client, id: ID, driverId: ID): Promise<void> {
  const who = await actor(client);
  const driver = await resolveDriver(client, driverId);
  const current = await client.query(
    "select status, reference, customer_name, driver_id from orders where id = $1",
    [id],
  );
  if (!current.rows[0]) throw new Error("Commande introuvable.");
  const prevDriverId = current.rows[0].driver_id ? String(current.rows[0].driver_id) : null;
  const alreadyDelivered = current.rows[0].status === "livree";
  const status = alreadyDelivered ? "livree" : "assignee";
  const items = await client.query("select * from order_items where order_id = $1", [id]);
  const mapped = items.rows.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    variant_id: row.variant_id,
    quantity: row.quantity,
    product_name: row.product_name,
    from_driver: row.from_driver,
  }));
  if (prevDriverId !== driver.id && (alreadyDelivered || stockAlreadyHeld(items.rows))) {
    if (prevDriverId) {
      await restoreDriverOrderItems(
        client,
        prevDriverId,
        items.rows,
        who.id,
        String(current.rows[0].reference),
      );
    }
    if (alreadyDelivered) {
      await takeDriverOrderItems(client, driver.id, mapped, who.id, String(current.rows[0].reference));
    } else {
      await client.query("update order_items set from_driver = null where order_id = $1", [id]);
    }
  }
  await client.query("update orders set driver_id = $2, status = $3 where id = $1", [id, driver.id, status]);
  await client.query(
    `insert into order_events (id, order_id, status, note, user_name, created_at)
     values ($1,$2,$3,$4,$5, now())`,
    [nextId("evt"), id, status, `Assignée à ${driver.fullName}`, who.fullName],
  );
  await audit(client, "Assignation livreur", "Order", id);
  const title = `Nouvelle commande ${current.rows[0].reference}`;
  const message = `${current.rows[0].customer_name} · ${driver.fullName}`;
  await pingManagers(client, {
    title: `Livreur assigné · ${current.rows[0].reference}`,
    message,
    href: "/commandes",
  });
  await pingUsers([asUserId(driver.userId)], {
    title,
    message: `${current.rows[0].customer_name} — à livrer`,
    href: "/livreur",
  });
}

export async function updateOrder(client: Client, id: ID, patch: Partial<Order>): Promise<void> {
  const current = await client.query("select * from orders where id = $1", [id]);
  const row = current.rows[0];
  if (!row) return;
  await client.query(
    `update orders set
      customer_name = $2, phone = $3, commune_id = $4, zone_id = $5, address_detail = $6,
      landmark = $7, notes = $8, delivery_fee = $9, payment_state = $10, status = $11, driver_id = $12
     where id = $1`,
    [
      id,
      patch.customerName ?? row.customer_name,
      patch.phone ?? row.phone,
      patch.communeId ?? row.commune_id,
      patch.zoneId ?? row.zone_id,
      patch.addressDetail ?? row.address_detail,
      patch.landmark ?? row.landmark,
      patch.notes ?? row.notes,
      patch.deliveryFee ?? row.delivery_fee,
      patch.paymentState ?? row.payment_state,
      patch.status ?? row.status,
      patch.driverId !== undefined ? (patch.driverId ?? null) : row.driver_id,
    ],
  );
  await audit(client, "Modification commande", "Order", id);
}

export async function replaceOrderItems(
  client: Client,
  id: ID,
  items: Array<Omit<OrderItem, "id">>,
): Promise<void> {
  const who = await actor(client);
  const current = await client.query("select * from orders where id = $1", [id]);
  const order = current.rows[0];
  if (!order) return;
  const oldItems = await client.query("select * from order_items where order_id = $1", [id]);
  const delivered = order.status === "livree";
  const driverId = order.driver_id ? String(order.driver_id) : null;
  const held = Boolean(driverId && (delivered || stockAlreadyHeld(oldItems.rows)));
  if (held && driverId) {
    await restoreDriverOrderItems(client, driverId, oldItems.rows, who.id, String(order.reference));
  } else if (delivered) {
    for (const it of oldItems.rows) {
      await adjustVariantStock(
        client,
        it.variant_id ? String(it.variant_id) : undefined,
        String(it.product_id),
        Number(it.quantity),
        "entree",
        who.id,
        `Correction commande ${order.reference}`,
        String(order.reference),
      );
    }
  }
  await client.query("delete from order_items where order_id = $1", [id]);
  const nextItems: OrderItem[] = items.map((it, i) => ({ ...it, id: nextId(`oit${i}`) }));
  for (const it of nextItems) {
    await client.query(
      `insert into order_items (id, order_id, product_id, variant_id, product_name, quantity, unit_price, discount)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [it.id, id, it.productId, it.variantId ?? null, it.productName, it.quantity, it.unitPrice, it.discount],
    );
    if (!held && delivered) {
      await adjustVariantStock(
        client,
        it.variantId,
        it.productId,
        it.quantity,
        "sortie",
        who.id,
        `Correction commande ${order.reference}`,
        String(order.reference),
      );
    }
  }
  if (held && driverId && delivered) {
    await takeDriverOrderItems(
      client,
      driverId,
      nextItems.map((it) => ({
        id: it.id,
        product_id: it.productId,
        variant_id: it.variantId,
        quantity: it.quantity,
        product_name: it.productName,
      })),
      who.id,
      String(order.reference),
    );
  }
  const productsTotal = Math.round(nextItems.reduce((s, it) => s + it.unitPrice * it.quantity - it.discount, 0) * 100) / 100;
  await client.query("update orders set products_total = $2, total_to_collect = $2 where id = $1", [id, productsTotal]);
  await client.query(
    `insert into order_events (id, order_id, status, note, user_name, created_at)
     values ($1,$2,$3,$4,$5, now())`,
    [nextId("evt"), id, order.status, "Articles corrigés (variante / taille)", who.fullName],
  );
  await audit(client, "Correction articles commande", "Order", id);
  await pingManagers(client, {
    title: `Commande ${order.reference} corrigée`,
    message: `${who.fullName} a modifié les articles (stock ajusté).`,
    level: "alerte",
    href: "/commandes",
  });
}

export async function removeOrder(client: Client, id: ID): Promise<void> {
  const current = await client.query("select * from orders where id = $1", [id]);
  const order = current.rows[0];
  if (!order) return;
  const items = await client.query("select * from order_items where order_id = $1", [id]);
  const who = await actor(client);
  const driverId = order.driver_id ? String(order.driver_id) : null;
  const delivered = order.status === "livree";
  const held = Boolean(driverId && (delivered || stockAlreadyHeld(items.rows)));
  if (held && driverId) {
    await restoreDriverOrderItems(client, driverId, items.rows, who.id, String(order.reference));
  } else if (delivered) {
    for (const it of items.rows) {
      await adjustVariantStock(
        client,
        it.variant_id ? String(it.variant_id) : undefined,
        String(it.product_id),
        Number(it.quantity),
        "entree",
        who.id,
        `Annulation ${order.reference}`,
        String(order.reference),
      );
    }
  }
  await client.query("delete from order_events where order_id = $1", [id]);
  await client.query("delete from order_items where order_id = $1", [id]);
  await client.query("delete from deliveries where order_id = $1", [id]);
  await client.query("delete from orders where id = $1", [id]);
  await audit(client, "Suppression commande", "Order", id);
}

/* ---------------------------------- Ventes --------------------------------- */

export type SaleCreateInput = {
  posteId: ID;
  customerId?: ID;
  customerName: string;
  discount: number;
  receivedUsd?: number;
  receivedCdf?: number;
  kind?: SaleKind;
  items: Array<Omit<SaleItem, "id">>;
};

export async function createSale(client: Client, input: SaleCreateInput): Promise<Sale> {
  const who = await actor(client);
  const kind: SaleKind = input.kind === "gros" ? "gros" : "comptoir";
  const count = await client.query("select count(*)::int as n from sales");
  const n = Number(count.rows[0]?.n ?? 0);
  const id = nextId("ven");
  const createdAt = nowIso();
  const items: SaleItem[] = input.items.map((it, i) => ({
    ...it,
    id: nextId(`sit${i}`),
    quantity: Math.max(1, Math.round(Number(it.quantity) || 0)),
    unitPrice: Number(it.unitPrice) || 0,
    discount: Number(it.discount) || 0,
  }));
  if (!items.length) throw new Error("Ajoutez au moins un article.");
  for (const it of items) {
    if (!it.variantId) throw new Error(`Choisissez une variante pour ${it.productName}`);
    const stock = await client.query("select stock from product_variants where id = $1", [it.variantId]);
    const available = Number(stock.rows[0]?.stock ?? 0);
    if (available < it.quantity) {
      throw new Error(`${it.productName} : stock boutique insuffisant (${available} restant).`);
    }
  }
  const subtotal = Math.round(items.reduce((s, it) => s + it.unitPrice * it.quantity - it.discount, 0) * 100) / 100;
  const total = Math.round((subtotal - input.discount) * 100) / 100;
  const prefix = kind === "gros" ? "GROS" : "POS";
  const reference = `${prefix}-${new Date().getFullYear()}-${2000 + n + 1}`;
  const receivedUsd = input.receivedUsd ?? total;
  const receivedCdf = input.receivedCdf ?? 0;
  const saleLabel = kind === "gros" ? "Vente gros" : "Vente POS";

  await client.query(
    `insert into sales (id, reference, poste_id, user_id, user_name, customer_id, customer_name, subtotal, discount, total, received_usd, received_cdf, created_at, kind)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [id, reference, input.posteId, who.id, who.fullName, input.customerId ?? null, input.customerName, subtotal, input.discount, total, receivedUsd, receivedCdf, createdAt, kind],
  );
  for (const it of items) {
    await client.query(
      `insert into sale_items (id, sale_id, product_id, variant_id, product_name, quantity, unit_price, discount)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [it.id, id, it.productId, it.variantId ?? null, it.productName, it.quantity, it.unitPrice, it.discount],
    );
    if (it.variantId) {
      const updated = await client.query(
        "update product_variants set stock = stock - $2, sold = sold + $2 where id = $1 and stock >= $2",
        [it.variantId, it.quantity],
      );
      if (!updated.rowCount) {
        throw new Error(`${it.productName} : stock boutique insuffisant.`);
      }
    }
    await client.query(
      `insert into stock_movements (id, reference, product_id, variant_id, quantity, type, user_id, note, created_at)
       values ($1,$2,$3,$4,$5,'sortie',$6,$7,$8)`,
      [nextId("mvt"), reference, it.productId, it.variantId ?? null, -it.quantity, who.id, `${saleLabel} ${reference}`, createdAt],
    );
  }
  await client.query(
    `insert into financial_transactions (id, reference, type, label, amount, direction, created_at)
     values ($1,$2,'vente',$3,$4,'entree',$5)`,
    [nextId("trx"), reference, `${saleLabel} — ${input.customerName}`, total, createdAt],
  );
  await audit(client, `${saleLabel} enregistrée`, "Sale", reference);
  return {
    id,
    reference,
    posteId: input.posteId,
    userId: who.id,
    userName: who.fullName,
    customerName: input.customerName,
    items,
    subtotal,
    discount: input.discount,
    total,
    receivedUsd,
    receivedCdf,
    createdAt,
    kind,
    ...(input.customerId ? { customerId: input.customerId } : {}),
  };
}

/* --------------------------------- Clients --------------------------------- */

export async function createCustomer(
  client: Client,
  input: Omit<Customer, "id" | "createdAt" | "totalSpent" | "ordersCount" | "regular">,
): Promise<Customer> {
  const id = nextId("cli");
  const createdAt = nowIso();
  await client.query(
    `insert into customers (id, full_name, phone, commune_id, zone_id, address, notes, total_spent, orders_count, regular, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,0,0,false,$8)`,
    [id, input.fullName, input.phone, input.communeId, input.zoneId, input.address, input.notes, createdAt],
  );
  await audit(client, "Création client", "Customer", input.fullName);
  return { ...input, id, totalSpent: 0, ordersCount: 0, regular: false, createdAt };
}

export async function updateCustomer(client: Client, id: ID, patch: Partial<Customer>): Promise<void> {
  const current = await client.query("select * from customers where id = $1", [id]);
  const row = current.rows[0];
  if (!row) return;
  await client.query(
    `update customers set full_name = $2, phone = $3, commune_id = $4, zone_id = $5, address = $6, notes = $7, regular = $8
     where id = $1`,
    [
      id,
      patch.fullName ?? row.full_name,
      patch.phone ?? row.phone,
      patch.communeId ?? row.commune_id,
      patch.zoneId ?? row.zone_id,
      patch.address ?? row.address,
      patch.notes ?? row.notes,
      patch.regular ?? row.regular,
    ],
  );
  await audit(client, "Modification client", "Customer", id);
}

export async function removeCustomer(client: Client, id: ID): Promise<void> {
  await client.query("delete from customers where id = $1", [id]);
  await audit(client, "Suppression client", "Customer", id);
}

/* ------------------------- Fournisseurs & achats --------------------------- */

export async function createSupplier(client: Client, input: Omit<Supplier, "id" | "createdAt">): Promise<Supplier> {
  const id = nextId("sup");
  const createdAt = nowIso();
  await client.query(
    `insert into suppliers (id, name, contact_name, phone, email, address, debt, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, input.name, input.contactName, input.phone, input.email, input.address, input.debt, createdAt],
  );
  await audit(client, "Création fournisseur", "Supplier", input.name);
  return { ...input, id, createdAt };
}

export async function updateSupplier(client: Client, id: ID, patch: Partial<Supplier>): Promise<void> {
  const current = await client.query("select * from suppliers where id = $1", [id]);
  const row = current.rows[0];
  if (!row) return;
  await client.query(
    `update suppliers set name = $2, contact_name = $3, phone = $4, email = $5, address = $6, debt = $7 where id = $1`,
    [
      id,
      patch.name ?? row.name,
      patch.contactName ?? row.contact_name,
      patch.phone ?? row.phone,
      patch.email ?? row.email,
      patch.address ?? row.address,
      patch.debt ?? row.debt,
    ],
  );
  await audit(client, "Modification fournisseur", "Supplier", id);
}

export async function removeSupplier(client: Client, id: ID): Promise<void> {
  await client.query("delete from suppliers where id = $1", [id]);
  await audit(client, "Suppression fournisseur", "Supplier", id);
}

export async function receivePurchaseOrder(client: Client, purchaseOrderId: ID): Promise<void> {
  const who = await actor(client);
  const poRes = await client.query("select * from purchase_orders where id = $1", [purchaseOrderId]);
  const order = poRes.rows[0];
  if (!order) return;
  const items = await client.query("select * from purchase_items where purchase_order_id = $1", [purchaseOrderId]);
  const createdAt = nowIso();
  await client.query(
    "update purchase_orders set status = 'recue', received_at = $2 where id = $1",
    [purchaseOrderId, createdAt],
  );
  for (const it of items.rows) {
    const remaining = Number(it.quantity) - Number(it.received);
    await client.query("update purchase_items set received = quantity where id = $1", [it.id]);
    if (remaining <= 0) continue;
    const variants = await client.query(
      "select id from product_variants where product_id = $1 order by sku limit 1",
      [it.product_id],
    );
    const variantId = variants.rows[0]?.id;
    if (variantId) {
      await client.query("update product_variants set stock = stock + $2 where id = $1", [variantId, remaining]);
    }
    await client.query(
      `insert into stock_movements (id, reference, product_id, variant_id, quantity, type, user_id, note, created_at)
       values ($1,$2,$3,$4,$5,'entree',$6,$7,$8)`,
      [nextId("mvt"), order.reference, it.product_id, variantId ?? null, remaining, who.id, `Réception achat ${order.reference}`, createdAt],
    );
  }
  await audit(client, "Réception marchandise", "PurchaseOrder", String(order.reference));
}

/* --------------------------------- Finance --------------------------------- */

export async function addExpense(
  client: Client,
  input: Omit<Expense, "id" | "reference" | "createdAt" | "userId">,
): Promise<Expense> {
  const who = await actor(client);
  const id = nextId("dep");
  const reference = `DEP-${Math.floor(Math.random() * 9000) + 1000}`;
  const createdAt = nowIso();
  await client.query(
    `insert into expenses (id, reference, label, category, amount, user_id, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, reference, input.label, input.category, input.amount, who.id, createdAt],
  );
  await client.query(
    `insert into financial_transactions (id, reference, type, label, amount, direction, created_at)
     values ($1,$2,'depense',$3,$4,'sortie',$5)`,
    [nextId("trx"), reference, input.label, input.amount, createdAt],
  );
  await audit(client, "Dépense enregistrée", "Expense", reference);
  return { ...input, id, reference, userId: who.id, createdAt };
}

export async function closeCashSession(client: Client, id: ID, closingAmount: number): Promise<void> {
  await client.query(
    "update cash_sessions set closing_amount = $2, status = 'cloturee', closed_at = now() where id = $1",
    [id, closingAmount],
  );
  await audit(client, "Clôture de caisse", "CashSession", id);
}

/* ------------------------------- Utilisateurs ------------------------------ */

export type UserCreateInput = Omit<User, "id" | "createdAt" | "lastLoginAt"> & {
  password: string;
  vehicle?: string;
};

export async function createUser(client: Client, input: UserCreateInput): Promise<User> {
  const id = nextId("usr");
  const createdAt = nowIso();
  const email = input.email || `${input.badge.toLowerCase()}@local`;
  await client.query(
    `insert into users (id, full_name, email, phone, badge, password_hash, role, status, poste_id, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      input.fullName,
      email,
      input.phone,
      input.badge,
      hashPassword(input.password),
      input.role,
      input.status,
      input.role === "ADMIN" ? null : (input.posteId || null),
      createdAt,
    ],
  );
  const extras = sanitizeExtras(input.extraPermissions);
  for (const perm of extras) {
    await client.query("insert into user_permissions (user_id, permission) values ($1,$2)", [id, perm]);
  }
  if (input.role === "LIVREUR") {
    await client.query(
      `insert into delivery_drivers (id, user_id, full_name, phone, vehicle, active, can_sell)
       values ($1,$2,$3,$4,$5,true,$6)`,
      [nextId("drv"), id, input.fullName, input.phone, input.vehicle ?? "Moto", true],
    );
  }
  await audit(client, "Création utilisateur", "User", input.badge);
  const { password: _pw, vehicle: _v, extraPermissions: _e, ...rest } = input;
  return { ...rest, extraPermissions: extras, id, email, createdAt };
}

export async function setUserPassword(client: Client, id: ID, password: string): Promise<void> {
  await client.query("update users set password_hash = $2 where id = $1", [id, hashPassword(password)]);
  await audit(client, "Réinitialisation mot de passe", "User", id);
}

export async function updateUser(client: Client, id: ID, patch: Partial<User>): Promise<void> {
  const current = await client.query("select * from users where id = $1", [id]);
  const row = current.rows[0];
  if (!row) return;
  await client.query(
    `update users set full_name = $2, email = $3, phone = $4, badge = $5, role = $6, status = $7, poste_id = $8, last_login_at = $9
     where id = $1`,
    [
      id,
      patch.fullName ?? row.full_name,
      patch.email ?? row.email,
      patch.phone ?? row.phone,
      patch.badge ?? row.badge,
      patch.role ?? row.role,
      patch.status ?? row.status,
      String(patch.role ?? row.role) === "ADMIN" ? null : patch.posteId !== undefined ? patch.posteId || null : row.poste_id,
      patch.lastLoginAt !== undefined ? (patch.lastLoginAt ?? null) : row.last_login_at,
    ],
  );
  if (patch.extraPermissions) {
    await client.query("delete from user_permissions where user_id = $1", [id]);
    for (const perm of sanitizeExtras(patch.extraPermissions)) {
      await client.query("insert into user_permissions (user_id, permission) values ($1,$2)", [id, perm]);
    }
  }
  const role = String(patch.role ?? row.role);
  if (role === "LIVREUR") {
    const existing = await client.query("select id from delivery_drivers where user_id = $1", [id]);
    const fullName = String(patch.fullName ?? row.full_name);
    const phone = String(patch.phone ?? row.phone ?? "");
    if (existing.rows[0]) {
      await client.query("update delivery_drivers set full_name = $2, phone = $3, active = true where user_id = $1", [
        id,
        fullName,
        phone,
      ]);
    } else {
      await client.query(
        `insert into delivery_drivers (id, user_id, full_name, phone, vehicle, active, can_sell)
         values ($1,$2,$3,$4,'Moto',true,false)`,
        [nextId("drv"), id, fullName, phone],
      );
    }
  }
  await audit(client, "Modification utilisateur", "User", id);
}

export async function removeUser(client: Client, id: ID): Promise<void> {
  await client.query("delete from users where id = $1", [id]);
  await audit(client, "Suppression utilisateur", "User", id);
}

export async function markAllNotificationsRead(client: Client, userId?: string): Promise<void> {
  if (userId) {
    await client.query("update notifications set read = true where read = false and user_id = $1", [userId]);
    return;
  }
  await client.query("update notifications set read = true where read = false");
}

export async function updateCompany(client: Client, patch: Partial<CompanySettings>): Promise<void> {
  const current = await client.query("select * from company_settings where id = 'company'");
  const row = current.rows[0];
  if (!row) return;
  await client.query(
    `update company_settings set
      name = $1, legal_name = $2, phone = $3, email = $4, address = $5,
      currency = $6, default_delivery_fee = $7, low_stock_alert = $8, usd_cdf_rate = $9, mapbox_token = $10, updated_at = now()
     where id = 'company'`,
    [
      patch.name ?? row.name,
      patch.legalName ?? row.legal_name,
      patch.phone ?? row.phone,
      patch.email ?? row.email,
      patch.address ?? row.address,
      patch.currency ?? row.currency,
      patch.defaultDeliveryFee ?? row.default_delivery_fee,
      patch.lowStockAlert ?? row.low_stock_alert,
      patch.usdCdfRate ?? row.usd_cdf_rate,
      patch.mapboxToken !== undefined ? patch.mapboxToken.trim() : row.mapbox_token,
    ],
  );
  await audit(client, "Modification paramètres", "CompanySettings");
}

export async function createPoste(
  client: Client,
  input: Omit<Poste, "id">,
): Promise<Poste> {
  const id = nextId("pos");
  await client.query(
    "insert into postes (id, name, address, type) values ($1,$2,$3,$4)",
    [id, input.name, input.address, input.type],
  );
  await audit(client, "Création poste", "Poste", input.name);
  return { ...input, id };
}

export async function updatePoste(
  client: Client,
  id: ID,
  patch: { name?: string; address?: string; type?: Poste["type"] },
): Promise<void> {
  const current = await client.query("select * from postes where id = $1", [id]);
  const row = current.rows[0];
  if (!row) return;
  await client.query("update postes set name = $2, address = $3, type = $4 where id = $1", [
    id,
    patch.name ?? row.name,
    patch.address ?? row.address,
    patch.type ?? row.type,
  ]);
  await audit(client, "Modification poste", "Poste", id);
}

export async function removePoste(client: Client, id: ID): Promise<void> {
  const sales = await client.query("select count(*)::int as n from sales where poste_id = $1", [id]);
  if (Number(sales.rows[0]?.n ?? 0) > 0) {
    throw new Error("Impossible de supprimer : des ventes sont rattachées à ce poste.");
  }
  await client.query("delete from postes where id = $1", [id]);
  await audit(client, "Suppression poste", "Poste", id);
}

export async function updateZoneFee(client: Client, id: ID, defaultFee: number): Promise<void> {
  await client.query("update delivery_zones set default_fee = $2 where id = $1", [id, defaultFee]);
}

export async function createCommune(client: Client, name: string): Promise<Commune> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nom de commune requis.");
  const existing = await client.query("select id, name from communes where lower(name) = lower($1)", [trimmed]);
  if (existing.rows[0]) {
    return { id: String(existing.rows[0].id), name: String(existing.rows[0].name) };
  }
  const id = nextId("com");
  await client.query("insert into communes (id, name) values ($1,$2)", [id, trimmed]);
  await audit(client, "Création commune", "Commune", trimmed);
  return { id, name: trimmed };
}

export async function createZone(
  client: Client,
  input: { communeId: ID; name: string; defaultFee: number },
): Promise<DeliveryZone> {
  const name = input.name.trim();
  if (!input.communeId) throw new Error("Choisissez une commune.");
  if (!name) throw new Error("Nom de quartier / zone requis.");
  const commune = await client.query("select id from communes where id = $1", [input.communeId]);
  if (!commune.rows[0]) throw new Error("Commune introuvable.");
  const dup = await client.query(
    "select id from delivery_zones where commune_id = $1 and lower(name) = lower($2)",
    [input.communeId, name],
  );
  if (dup.rows[0]) throw new Error("Cette zone existe déjà pour la commune.");
  const id = nextId("zon");
  const defaultFee = Math.max(0, Number(input.defaultFee) || 0);
  await client.query(
    "insert into delivery_zones (id, commune_id, name, default_fee) values ($1,$2,$3,$4)",
    [id, input.communeId, name, defaultFee],
  );
  await audit(client, "Création zone livraison", "DeliveryZone", name);
  return { id, communeId: input.communeId, name, defaultFee };
}

export async function collectOrderPayment(
  client: Client,
  id: ID,
  receivedUsd: number,
  receivedCdf: number,
): Promise<void> {
  await client.query("update orders set received_usd = $2, received_cdf = $3 where id = $1", [
    id,
    receivedUsd,
    receivedCdf,
  ]);
  await audit(client, "Encaissement commande", "Order", id);
}
