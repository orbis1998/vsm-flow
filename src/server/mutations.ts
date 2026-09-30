import type { PoolClient } from "pg";
import { nextId } from "@/lib/app-state";
import { hashPassword } from "./password";
import type {
  CompanySettings,
  Customer,
  Expense,
  ID,
  Order,
  OrderItem,
  OrderStatus,
  Poste,
  Product,
  Sale,
  SaleItem,
  StockMovementType,
  Supplier,
  User,
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
  client: Client,
  payload: { title: string; message: string; level?: "info" | "alerte" | "critique"; href?: string },
): Promise<void> {
  try {
    const { notifyManagers } = await import("./notify");
    const { sendWebPush } = await import("./push");
    const userIds = await notifyManagers(client, payload);
    await sendWebPush(client, userIds, { title: payload.title, body: payload.message, href: payload.href });
  } catch {
    // notification must never block the métier
  }
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
};

export async function createOrder(client: Client, input: OrderCreateInput): Promise<Order> {
  const who = await actor(client);
  if (!input.items.length) throw new Error("Ajoutez au moins un article.");
  for (const it of input.items) {
    if (!it.variantId) throw new Error(`Stock indisponible pour ${it.productName}`);
    const stock = await client.query("select stock from product_variants where id = $1", [it.variantId]);
    const available = Number(stock.rows[0]?.stock ?? 0);
    if (available < it.quantity) {
      throw new Error(`${it.productName} : stock insuffisant (${available} restant).`);
    }
  }
  const count = await client.query("select count(*)::int as n from orders");
  const n = Number(count.rows[0]?.n ?? 0);
  const id = nextId("ord");
  const createdAt = nowIso();
  const items: OrderItem[] = input.items.map((it, i) => ({ ...it, id: nextId(`oit${i}`) }));
  const productsTotal = Math.round(items.reduce((s, it) => s + it.unitPrice * it.quantity - it.discount, 0) * 100) / 100;
  const totalToCollect = productsTotal;
  const reference = `CMD-${new Date().getFullYear()}-${1000 + n + 1}`;
  const evtId = nextId("evt");
  const customerName = input.customerName.trim() || "Client";
  const assigned = input.driverId ? await resolveDriver(client, input.driverId) : null;
  const status: OrderStatus = assigned ? "assignee" : "nouvelle";
  const createdNote = assigned ? `Commande enregistrée · ${assigned.fullName}` : "Commande enregistrée";

  await client.query(
    `insert into orders (
      id, reference, customer_id, customer_name, phone, commune_id, zone_id, address_detail, landmark,
      products_total, delivery_fee, total_to_collect, payment_state, notes, status, received_usd, received_cdf, created_at, driver_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'non_paye',$13,$14,0,0,$15,$16)`,
    [
      id,
      reference,
      input.customerId || null,
      customerName,
      input.phone,
      input.communeId,
      input.zoneId,
      input.addressDetail,
      input.landmark,
      productsTotal,
      input.deliveryFee,
      totalToCollect,
      input.notes,
      status,
      createdAt,
      assigned?.id ?? null,
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
    deliveryFee: input.deliveryFee,
    totalToCollect,
    paymentState: "non_paye",
    notes: input.notes,
    status,
    receivedUsd: 0,
    receivedCdf: 0,
    createdAt,
    history: [{ id: evtId, status, note: createdNote, userName: who.fullName, createdAt }],
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(assigned ? { driverId: assigned.id } : {}),
  };
}

export async function updateOrderStatus(client: Client, id: ID, status: OrderStatus, note: string): Promise<void> {
  const who = await actor(client);
  const current = await client.query("select * from orders where id = $1", [id]);
  const order = current.rows[0];
  if (!order) return;
  const paymentState = status === "livree" ? "paye" : order.payment_state;
  await client.query("update orders set status = $2, payment_state = $3 where id = $1", [id, status, paymentState]);
  await client.query(
    `insert into order_events (id, order_id, status, note, user_name, created_at)
     values ($1,$2,$3,$4,$5, now())`,
    [nextId("evt"), id, status, note, who.fullName],
  );
  if (status === "livree" && order.status !== "livree") {
    const items = await client.query("select * from order_items where order_id = $1", [id]);
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
    await client.query(
      `insert into financial_transactions (id, reference, type, label, amount, direction, created_at)
       values ($1,$2,'encaissement',$3,$4,'entree', now())`,
      [
        nextId("trx"),
        order.reference,
        `Encaissement livraison — ${order.customer_name}`,
        order.products_total,
      ],
    );
  }
  await audit(client, "Changement de statut commande", "Order", id);
  const labels: Record<string, string> = {
    en_livraison: "en route",
    livree: "livrée",
    echec: "en échec",
  };
  if (labels[status]) {
    await pingManagers(client, {
      title: `Commande ${order.reference} ${labels[status]}`,
      message: `${order.customer_name} · ${who.fullName}`,
      level: status === "echec" ? "alerte" : "info",
      href: "/commandes",
    });
  }
}

async function resolveDriver(client: Client, driverId: ID): Promise<{ id: string; fullName: string }> {
  const byId = await client.query("select id, full_name from delivery_drivers where id = $1", [driverId]);
  if (byId.rows[0]) return { id: String(byId.rows[0].id), fullName: String(byId.rows[0].full_name) };
  const byUser = await client.query("select id, full_name from delivery_drivers where user_id = $1", [driverId]);
  if (byUser.rows[0]) return { id: String(byUser.rows[0].id), fullName: String(byUser.rows[0].full_name) };
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
    const again = await client.query("select id, full_name from delivery_drivers where user_id = $1", [user.rows[0].id]);
    if (again.rows[0]) return { id: String(again.rows[0].id), fullName: String(again.rows[0].full_name) };
  }
  throw new Error("Livreur introuvable. Créez un compte rôle Livreur dans Équipe.");
}

export async function assignDriver(client: Client, id: ID, driverId: ID): Promise<void> {
  const who = await actor(client);
  const driver = await resolveDriver(client, driverId);
  const current = await client.query("select status, reference, customer_name from orders where id = $1", [id]);
  if (!current.rows[0]) throw new Error("Commande introuvable.");
  const status = current.rows[0].status === "livree" ? "livree" : "assignee";
  await client.query("update orders set driver_id = $2, status = $3 where id = $1", [id, driver.id, status]);
  await client.query(
    `insert into order_events (id, order_id, status, note, user_name, created_at)
     values ($1,$2,$3,$4,$5, now())`,
    [nextId("evt"), id, status, `Assignée à ${driver.fullName}`, who.fullName],
  );
  await audit(client, "Assignation livreur", "Order", id);
  await pingManagers(client, {
    title: `Livreur assigné · ${current.rows[0].reference}`,
    message: `${driver.fullName} · ${current.rows[0].customer_name}`,
    href: "/commandes",
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
  if (delivered) {
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
    if (delivered) {
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
  items: Array<Omit<SaleItem, "id">>;
};

export async function createSale(client: Client, input: SaleCreateInput): Promise<Sale> {
  const who = await actor(client);
  const count = await client.query("select count(*)::int as n from sales");
  const n = Number(count.rows[0]?.n ?? 0);
  const id = nextId("ven");
  const createdAt = nowIso();
  const items: SaleItem[] = input.items.map((it, i) => ({ ...it, id: nextId(`sit${i}`) }));
  const subtotal = Math.round(items.reduce((s, it) => s + it.unitPrice * it.quantity - it.discount, 0) * 100) / 100;
  const total = Math.round((subtotal - input.discount) * 100) / 100;
  const reference = `POS-${new Date().getFullYear()}-${2000 + n + 1}`;
  const receivedUsd = input.receivedUsd ?? total;
  const receivedCdf = input.receivedCdf ?? 0;

  await client.query(
    `insert into sales (id, reference, poste_id, user_id, user_name, customer_id, customer_name, subtotal, discount, total, received_usd, received_cdf, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, reference, input.posteId, who.id, who.fullName, input.customerId ?? null, input.customerName, subtotal, input.discount, total, receivedUsd, receivedCdf, createdAt],
  );
  for (const it of items) {
    await client.query(
      `insert into sale_items (id, sale_id, product_id, variant_id, product_name, quantity, unit_price, discount)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [it.id, id, it.productId, it.variantId ?? null, it.productName, it.quantity, it.unitPrice, it.discount],
    );
    if (it.variantId) {
      await client.query(
        "update product_variants set stock = greatest(0, stock - $2), sold = sold + $2 where id = $1",
        [it.variantId, it.quantity],
      );
    }
    await client.query(
      `insert into stock_movements (id, reference, product_id, variant_id, quantity, type, user_id, note, created_at)
       values ($1,$2,$3,$4,$5,'sortie',$6,$7,$8)`,
      [nextId("mvt"), reference, it.productId, it.variantId ?? null, -it.quantity, who.id, `Vente POS ${reference}`, createdAt],
    );
  }
  await client.query(
    `insert into financial_transactions (id, reference, type, label, amount, direction, created_at)
     values ($1,$2,'vente',$3,$4,'entree',$5)`,
    [nextId("trx"), reference, `Vente POS — ${input.customerName}`, total, createdAt],
  );
  await audit(client, "Vente POS enregistrée", "Sale", reference);
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
      input.posteId ?? null,
      createdAt,
    ],
  );
  for (const perm of input.extraPermissions) {
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
  const { password: _pw, vehicle: _v, ...rest } = input;
  return { ...rest, id, email, createdAt };
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
      patch.posteId !== undefined ? (patch.posteId ?? null) : row.poste_id,
      patch.lastLoginAt !== undefined ? (patch.lastLoginAt ?? null) : row.last_login_at,
    ],
  );
  if (patch.extraPermissions) {
    await client.query("delete from user_permissions where user_id = $1", [id]);
    for (const perm of patch.extraPermissions) {
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
      currency = $6, default_delivery_fee = $7, low_stock_alert = $8, usd_cdf_rate = $9, updated_at = now()
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
