/**
 * Couche de services — écritures via fonctions serveur Postgres.
 * L'UI lit l'état avec useAppState (TanStack Query).
 */
import { getAppStateFn, mutateAppFn, type AppMutation } from "@/fn/app";
import { refreshAppState } from "@/lib/query-client";
import type {
  Customer,
  Expense,
  ID,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  Sale,
  SaleItem,
  StockMovementType,
  Supplier,
  User,
} from "@/types";

export const referenceNow = new Date("2026-09-25T17:30:00.000Z");

async function mutate(payload: AppMutation) {
  const result = await mutateAppFn({ data: payload } as never);
  await refreshAppState();
  return result;
}

/* --------------------------------- Produits -------------------------------- */

export const productsService = {
  async list() {
    return (await getAppStateFn()).products;
  },
  async get(id: ID) {
    return (await getAppStateFn()).products.find((p) => p.id === id) ?? null;
  },
  async create(input: Omit<Product, "id" | "createdAt" | "variants"> & { variants?: Product["variants"] }) {
    return mutate({ op: "product.create", input }) as Promise<Product>;
  },
  async update(id: ID, patch: Partial<Product>) {
    await mutate({ op: "product.update", id, patch });
  },
  async remove(id: ID) {
    await mutate({ op: "product.remove", id });
  },
};

/* ---------------------------------- Stock ---------------------------------- */

export const stockService = {
  async listMovements() {
    return (await getAppStateFn()).movements;
  },
  async addMovement(input: {
    productId: ID;
    variantId?: ID;
    quantity: number;
    type: StockMovementType;
    note: string;
  }) {
    await mutate({ op: "stock.movement", input });
  },
  async restockDriver(input: { driverId: ID; productId: ID; variantId?: ID; quantity: number }) {
    await mutate({ op: "stock.driverRestock", input });
  },
};

/* -------------------------------- Commandes -------------------------------- */

export const ordersService = {
  async list() {
    return (await getAppStateFn()).orders;
  },
  async get(id: ID) {
    return (await getAppStateFn()).orders.find((o) => o.id === id) ?? null;
  },
  async create(input: {
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
  }) {
    return mutate({ op: "order.create", input }) as Promise<Order>;
  },
  async updateStatus(
    id: ID,
    status: OrderStatus,
    note = "Statut mis à jour",
    received?: { receivedUsd?: number; receivedCdf?: number },
  ) {
    await mutate({
      op: "order.status",
      id,
                  status,
                  note,
      ...(received?.receivedUsd != null ? { receivedUsd: received.receivedUsd } : {}),
      ...(received?.receivedCdf != null ? { receivedCdf: received.receivedCdf } : {}),
    });
  },
  async assignDriver(id: ID, driverId: ID) {
    await mutate({ op: "order.assign", id, driverId });
  },
  async update(id: ID, patch: Partial<Order>) {
    await mutate({ op: "order.update", id, patch });
  },
  async replaceItems(id: ID, items: Array<Omit<OrderItem, "id">>) {
    await mutate({ op: "order.items", id, items });
  },
  async collectPayment(id: ID, receivedUsd: number, receivedCdf: number) {
    await mutate({ op: "order.collect", id, receivedUsd, receivedCdf });
  },
  async remove(id: ID) {
    await mutate({ op: "order.remove", id });
  },
};

/* ---------------------------------- Ventes --------------------------------- */

export const salesService = {
  async list() {
    return (await getAppStateFn()).sales;
  },
  async create(input: {
    posteId: ID;
    customerId?: ID;
    customerName: string;
    discount: number;
    receivedUsd?: number;
    receivedCdf?: number;
    items: Array<Omit<SaleItem, "id">>;
  }) {
    return mutate({ op: "sale.create", input }) as Promise<Sale>;
  },
};

/* --------------------------------- Clients --------------------------------- */

export const customersService = {
  async list() {
    return (await getAppStateFn()).customers;
  },
  async get(id: ID) {
    return (await getAppStateFn()).customers.find((c) => c.id === id) ?? null;
  },
  async create(input: Omit<Customer, "id" | "createdAt" | "totalSpent" | "ordersCount" | "regular">) {
    return mutate({ op: "customer.create", input }) as Promise<Customer>;
  },
  async update(id: ID, patch: Partial<Customer>) {
    await mutate({ op: "customer.update", id, patch });
  },
  async remove(id: ID) {
    await mutate({ op: "customer.remove", id });
  },
};

/* ------------------------- Fournisseurs & achats --------------------------- */

export const suppliersService = {
  async list() {
    return (await getAppStateFn()).suppliers;
  },
  async create(input: Omit<Supplier, "id" | "createdAt">) {
    return mutate({ op: "supplier.create", input }) as Promise<Supplier>;
  },
  async update(id: ID, patch: Partial<Supplier>) {
    await mutate({ op: "supplier.update", id, patch });
  },
  async remove(id: ID) {
    await mutate({ op: "supplier.remove", id });
  },
  async receivePurchaseOrder(purchaseOrderId: ID) {
    await mutate({ op: "purchase.receive", id: purchaseOrderId });
  },
};

/* --------------------------------- Finance --------------------------------- */

export const financeService = {
  async addExpense(input: Omit<Expense, "id" | "reference" | "createdAt" | "userId">) {
    return mutate({ op: "finance.expense", input }) as Promise<Expense>;
  },
  async closeCashSession(id: ID, closingAmount: number) {
    await mutate({ op: "finance.closeCash", id, closingAmount });
  },
};

/* ------------------------------- Utilisateurs ------------------------------ */

export const usersService = {
  async list() {
    return (await getAppStateFn()).users;
  },
  async create(input: Omit<User, "id" | "createdAt" | "lastLoginAt"> & { password: string; vehicle?: string }) {
    return mutate({ op: "user.create", input }) as Promise<User>;
  },
  async update(id: ID, patch: Partial<User>) {
    await mutate({ op: "user.update", id, patch });
  },
  async setPassword(id: ID, password: string) {
    await mutate({ op: "user.password", id, password });
  },
  async remove(id: ID) {
    await mutate({ op: "user.remove", id });
  },
};

/* ------------------------------ Notifications ------------------------------ */

export const notificationsService = {
  async markAllRead(userId?: ID) {
    await mutate({ op: "notifications.readAll", userId });
  },
};

/* -------------------------------- Paramètres ------------------------------- */

export const settingsService = {
  async updateCompany(patch: Partial<import("@/types").CompanySettings>) {
    await mutate({ op: "settings.company", patch });
  },
  async createPoste(input: { name: string; address: string; type: "boutique" | "entrepot" | "mobile" }) {
    await mutate({ op: "poste.create", input });
  },
  async updatePoste(id: ID, patch: { name?: string; address?: string; type?: "boutique" | "entrepot" | "mobile" }) {
    await mutate({ op: "poste.update", id, patch });
  },
  async removePoste(id: ID) {
    await mutate({ op: "poste.remove", id });
  },
  async updateZoneFee(id: ID, defaultFee: number) {
    await mutate({ op: "zone.fee", id, defaultFee });
  },
};
