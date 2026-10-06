import type {
  AppNotification,
  AuditLog,
  Brand,
  CashSession,
  Category,
  Commune,
  CompanySettings,
  Customer,
  Delivery,
  DeliveryDriver,
  DeliveryZone,
  DriverStockLine,
  Expense,
  FinancialTransaction,
  Order,
  OrderEvent,
  OrderItem,
  Poste,
  Product,
  ProductVariant,
  PurchaseItem,
  PurchaseOrder,
  Sale,
  SaleItem,
  StockMovement,
  Supplier,
  User,
} from "@/types";

export function num(value: unknown): number {
  if (value == null || value === "") return 0;
  return Number(value);
}

export function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function optStr(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  return String(value);
}

export function optIso(value: unknown): string | undefined {
  if (value == null) return undefined;
  return iso(value);
}

export function optNum(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  return Number(value);
}

export function mapCompany(row: Record<string, unknown>): CompanySettings {
  return {
    name: String(row.name ?? "Business Suite"),
    legalName: String(row.legal_name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    address: String(row.address ?? ""),
    currency: String(row.currency ?? "USD"),
    usdCdfRate: num(row.usd_cdf_rate) || 2800,
    defaultDeliveryFee: num(row.default_delivery_fee),
    lowStockAlert: Boolean(row.low_stock_alert),
  };
}

export function mapPoste(row: Record<string, unknown>): Poste {
  return {
    id: String(row.id),
    name: String(row.name),
    address: String(row.address ?? ""),
    type: row.type as Poste["type"],
  };
}

export function mapUser(row: Record<string, unknown>, extraPermissions: User["extraPermissions"]): User {
  const user: User = {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    phone: String(row.phone ?? ""),
    badge: String(row.badge ?? ""),
    role: row.role as User["role"],
    status: row.status as User["status"],
    extraPermissions,
    createdAt: iso(row.created_at),
  };
  const posteId = optStr(row.poste_id);
  if (posteId) user.posteId = posteId;
  const lastLoginAt = optIso(row.last_login_at);
  if (lastLoginAt) user.lastLoginAt = lastLoginAt;
  return user;
}

export function mapDriver(row: Record<string, unknown>, zoneIds: string[]): DeliveryDriver {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    fullName: String(row.full_name),
    phone: String(row.phone ?? ""),
    vehicle: String(row.vehicle ?? ""),
    zoneIds,
    canSell: row.can_sell === true || row.can_sell === "t" || row.can_sell === "true",
    active: row.active !== false && row.active !== "f" && row.active !== "false",
  };
}

export function mapCategory(row: Record<string, unknown>): Category {
  const cat: Category = { id: String(row.id), name: String(row.name) };
  const parentId = optStr(row.parent_id);
  if (parentId) cat.parentId = parentId;
  return cat;
}

export function mapBrand(row: Record<string, unknown>): Brand {
  return { id: String(row.id), name: String(row.name) };
}

export function mapSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id),
    name: String(row.name),
    contactName: String(row.contact_name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    address: String(row.address ?? ""),
    debt: num(row.debt),
    createdAt: iso(row.created_at),
  };
}

export function mapVariant(row: Record<string, unknown>): ProductVariant {
  const v: ProductVariant = {
    id: String(row.id),
    productId: String(row.product_id),
    sku: String(row.sku),
    barcode: String(row.barcode),
    stock: Number(row.stock ?? 0),
    reserved: Number(row.reserved ?? 0),
    sold: Number(row.sold ?? 0),
    options: (row.options && typeof row.options === "object" && !Array.isArray(row.options)
      ? (row.options as Record<string, string>)
      : {}),
  };
  const size = optStr(row.size);
  const color = optStr(row.color);
  const model = optStr(row.model);
  if (size) v.size = size;
  if (color) v.color = color;
  if (model) v.model = model;
  return v;
}

export function mapProduct(row: Record<string, unknown>, variants: ProductVariant[]): Product {
  const p: Product = {
    id: String(row.id),
    name: String(row.name),
    sku: String(row.sku),
    barcode: String(row.barcode),
    categoryId: String(row.category_id),
    brandId: String(row.brand_id),
    supplierId: String(row.supplier_id),
    purchasePrice: num(row.purchase_price),
    salePrice: num(row.sale_price),
    minStock: Number(row.min_stock ?? 0),
    unit: row.unit as Product["unit"],
    description: String(row.description ?? ""),
    imageLabel: String(row.image_label ?? ""),
    options: Array.isArray(row.options) ? (row.options as Product["options"]) : [],
    variants,
    createdAt: iso(row.created_at),
  };
  const imageUrl = optStr(row.image_url) || (String(row.image_label ?? "").startsWith("data:") ? String(row.image_label) : "");
  if (imageUrl) p.imageUrl = imageUrl;
  const customBarcode = optStr(row.custom_barcode);
  const promoPrice = optNum(row.promo_price);
  const lotNumber = optStr(row.lot_number);
  const expiryDate = optIso(row.expiry_date);
  if (customBarcode) p.customBarcode = customBarcode;
  if (promoPrice != null) p.promoPrice = promoPrice;
  if (lotNumber) p.lotNumber = lotNumber;
  if (expiryDate) p.expiryDate = expiryDate;
  return p;
}

export function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    phone: String(row.phone),
    communeId: String(row.commune_id),
    zoneId: String(row.zone_id),
    address: String(row.address ?? ""),
    notes: String(row.notes ?? ""),
    totalSpent: num(row.total_spent),
    ordersCount: Number(row.orders_count ?? 0),
    regular: Boolean(row.regular),
    createdAt: iso(row.created_at),
  };
}

export function mapOrderItem(row: Record<string, unknown>): OrderItem {
  const item: OrderItem = {
    id: String(row.id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    quantity: Number(row.quantity),
    unitPrice: num(row.unit_price),
    discount: num(row.discount),
  };
  const variantId = optStr(row.variant_id);
  if (variantId) item.variantId = variantId;
  return item;
}

export function mapOrderEvent(row: Record<string, unknown>): OrderEvent {
  return {
    id: String(row.id),
    status: row.status as OrderEvent["status"],
    note: String(row.note ?? ""),
    userName: String(row.user_name),
    createdAt: iso(row.created_at),
  };
}

export function mapOrder(
  row: Record<string, unknown>,
  items: OrderItem[],
  history: OrderEvent[],
): Order {
  const order: Order = {
    id: String(row.id),
    reference: String(row.reference),
    customerName: String(row.customer_name || "Client"),
    phone: String(row.phone),
    communeId: String(row.commune_id),
    zoneId: String(row.zone_id),
    addressDetail: String(row.address_detail ?? ""),
    landmark: String(row.landmark ?? ""),
    items,
    productsTotal: num(row.products_total),
    deliveryFee: num(row.delivery_fee),
    totalToCollect: num(row.total_to_collect),
    paymentState: row.payment_state as Order["paymentState"],
    notes: String(row.notes ?? ""),
    status: row.status as Order["status"],
    receivedUsd: num(row.received_usd),
    receivedCdf: num(row.received_cdf),
    createdAt: iso(row.created_at),
    history,
  };
  const driverId = optStr(row.driver_id);
  if (driverId) order.driverId = driverId;
  const customerId = optStr(row.customer_id);
  if (customerId) order.customerId = customerId;
  const posteId = optStr(row.poste_id);
  if (posteId) order.posteId = posteId;
  const dueAt = optIso(row.due_at);
  if (dueAt) order.dueAt = dueAt;
  return order;
}

export function mapDelivery(row: Record<string, unknown>): Delivery {
  const d: Delivery = {
    id: String(row.id),
    orderId: String(row.order_id),
    driverId: String(row.driver_id),
    status: row.status as Delivery["status"],
    collectedAmount: num(row.collected_amount),
    createdAt: iso(row.created_at),
  };
  const proof = optStr(row.proof);
  const closedAt = optIso(row.closed_at);
  if (proof) d.proof = proof;
  if (closedAt) d.closedAt = closedAt;
  return d;
}

export function mapPurchaseItem(row: Record<string, unknown>): PurchaseItem {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    quantity: Number(row.quantity),
    received: Number(row.received ?? 0),
    unitPurchasePrice: num(row.unit_purchase_price),
  };
}

export function mapPurchaseOrder(row: Record<string, unknown>, items: PurchaseItem[]): PurchaseOrder {
  const po: PurchaseOrder = {
    id: String(row.id),
    reference: String(row.reference),
    supplierId: String(row.supplier_id),
    status: row.status as PurchaseOrder["status"],
    items,
    total: num(row.total),
    paid: num(row.paid),
    createdAt: iso(row.created_at),
  };
  const receivedAt = optIso(row.received_at);
  if (receivedAt) po.receivedAt = receivedAt;
  return po;
}

export function mapSaleItem(row: Record<string, unknown>): SaleItem {
  const item: SaleItem = {
    id: String(row.id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    quantity: Number(row.quantity),
    unitPrice: num(row.unit_price),
    discount: num(row.discount),
  };
  const variantId = optStr(row.variant_id);
  if (variantId) item.variantId = variantId;
  return item;
}

export function mapSale(row: Record<string, unknown>, items: SaleItem[]): Sale {
  const sale: Sale = {
    id: String(row.id),
    reference: String(row.reference),
    posteId: String(row.poste_id),
    userId: String(row.user_id ?? ""),
    userName: String(row.user_name),
    customerName: String(row.customer_name ?? "Client comptoir"),
    items,
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    total: num(row.total),
    receivedUsd: num(row.received_usd),
    receivedCdf: num(row.received_cdf),
    createdAt: iso(row.created_at),
  };
  const customerId = optStr(row.customer_id);
  if (customerId) sale.customerId = customerId;
  if (row.kind === "gros") sale.kind = "gros";
  else if (row.kind === "comptoir") sale.kind = "comptoir";
  return sale;
}

export function mapDriverStock(row: Record<string, unknown>): DriverStockLine {
  const line: DriverStockLine = {
    id: String(row.id),
    driverId: String(row.driver_id),
    productId: String(row.product_id),
    quantity: Number(row.quantity ?? 0),
    updatedAt: iso(row.updated_at),
  };
  const variantId = optStr(row.variant_id);
  if (variantId) line.variantId = variantId;
  return line;
}

export function mapMovement(row: Record<string, unknown>): StockMovement {
  const m: StockMovement = {
    id: String(row.id),
    reference: String(row.reference),
    productId: String(row.product_id),
    quantity: Number(row.quantity),
    type: row.type as StockMovement["type"],
    userId: String(row.user_id ?? ""),
    note: String(row.note ?? ""),
    createdAt: iso(row.created_at),
  };
  const variantId = optStr(row.variant_id);
  if (variantId) m.variantId = variantId;
  return m;
}

export function mapExpense(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    reference: String(row.reference),
    label: String(row.label),
    category: row.category as Expense["category"],
    amount: num(row.amount),
    userId: String(row.user_id ?? ""),
    createdAt: iso(row.created_at),
  };
}

export function mapTransaction(row: Record<string, unknown>): FinancialTransaction {
  return {
    id: String(row.id),
    reference: String(row.reference),
    type: row.type as FinancialTransaction["type"],
    label: String(row.label),
    amount: num(row.amount),
    direction: row.direction as FinancialTransaction["direction"],
    createdAt: iso(row.created_at),
  };
}

export function mapCashSession(row: Record<string, unknown>): CashSession {
  const s: CashSession = {
    id: String(row.id),
    posteId: String(row.poste_id),
    openedBy: String(row.opened_by),
    openingAmount: num(row.opening_amount),
    expectedAmount: num(row.expected_amount),
    status: row.status as CashSession["status"],
    openedAt: iso(row.opened_at),
  };
  const closingAmount = optNum(row.closing_amount);
  const closedAt = optIso(row.closed_at);
  if (closingAmount != null) s.closingAmount = closingAmount;
  if (closedAt) s.closedAt = closedAt;
  return s;
}

export function mapNotification(row: Record<string, unknown>): AppNotification {
  const n: AppNotification = {
    id: String(row.id),
    title: String(row.title),
    message: String(row.message),
    level: row.level as AppNotification["level"],
    read: Boolean(row.read),
    createdAt: iso(row.created_at),
  };
  const userId = optStr(row.user_id);
  const href = optStr(row.href);
  if (userId) n.userId = userId;
  if (href) n.href = href;
  return n;
}

export function mapAudit(row: Record<string, unknown>): AuditLog {
  const log: AuditLog = {
    id: String(row.id),
    userId: String(row.user_id ?? ""),
    userName: String(row.user_name),
    action: String(row.action),
    entity: String(row.entity),
    createdAt: iso(row.created_at),
  };
  const entityId = optStr(row.entity_id);
  if (entityId) log.entityId = entityId;
  return log;
}

export function mapCommune(row: Record<string, unknown>): Commune {
  return { id: String(row.id), name: String(row.name) };
}

export function mapZone(row: Record<string, unknown>): DeliveryZone {
  return {
    id: String(row.id),
    communeId: String(row.commune_id),
    name: String(row.name),
    defaultFee: num(row.default_fee),
  };
}

export function groupBy<T extends Record<string, unknown>>(rows: T[], key: string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = String(row[key] ?? "");
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}
