/**
 * Couche de services.
 *
 * Toute l'UI passe par ces fonctions — jamais par le store directement pour
 * écrire. Elles sont asynchrones et renvoient des Promises, exactement comme
 * le fera l'implémentation Supabase/API : il suffira de remplacer le corps de
 * chaque fonction sans toucher aux composants.
 */
import { getState, nextId, setState } from "@/mock/store";
import { REFERENCE_NOW } from "@/mock/seed";
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
  StockMovement,
  StockMovementType,
  Supplier,
  User,
} from "@/types";

const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();

export const referenceNow = REFERENCE_NOW;

function log(action: string, entity: string, entityId?: string) {
  setState((s) => ({
    ...s,
    auditLogs: [
      {
        id: nextId("log"),
        userId: s.users[0]!.id,
        userName: s.users[0]!.fullName,
        action,
        entity,
        entityId,
        createdAt: now(),
      },
      ...s.auditLogs,
    ],
  }));
}

/* --------------------------------- Produits -------------------------------- */

export const productsService = {
  async list() {
    await delay();
    return getState().products;
  },
  async get(id: ID) {
    await delay();
    return getState().products.find((p) => p.id === id) ?? null;
  },
  async create(input: Omit<Product, "id" | "createdAt" | "variants"> & { variants?: Product["variants"] }) {
    await delay();
    const id = nextId("prd");
    const product: Product = {
      ...input,
      id,
      variants: (input.variants ?? []).map((v, i) => ({ ...v, id: `${id}-v${i + 1}`, productId: id })),
      createdAt: now(),
    };
    setState((s) => ({ ...s, products: [product, ...s.products] }));
    log("Création produit", "Product", product.sku);
    return product;
  },
  async update(id: ID, patch: Partial<Product>) {
    await delay();
    setState((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
    log("Modification produit", "Product", id);
  },
  async remove(id: ID) {
    await delay();
    setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));
    log("Suppression produit", "Product", id);
  },
};

/* ---------------------------------- Stock ---------------------------------- */

export const stockService = {
  async listMovements() {
    await delay();
    return getState().movements;
  },
  async addMovement(input: {
    productId: ID;
    variantId?: ID;
    quantity: number;
    type: StockMovementType;
    note: string;
  }) {
    await delay();
    const movement: StockMovement = {
      id: nextId("mvt"),
      reference: `MVT-${Math.floor(Math.random() * 9000) + 1000}`,
      productId: input.productId,
      variantId: input.variantId,
      quantity: input.quantity,
      type: input.type,
      userId: getState().users[0]!.id,
      note: input.note,
      createdAt: now(),
    };
    setState((s) => ({
      ...s,
      movements: [movement, ...s.movements],
      products: s.products.map((p) =>
        p.id !== input.productId
          ? p
          : {
              ...p,
              variants: p.variants.map((v) =>
                input.variantId
                  ? v.id === input.variantId
                    ? { ...v, stock: Math.max(0, v.stock + input.quantity) }
                    : v
                  : v.id === p.variants[0]!.id
                    ? { ...v, stock: Math.max(0, v.stock + input.quantity) }
                    : v,
              ),
            },
      ),
    }));
    log("Mouvement de stock", "StockMovement", movement.reference);
    return movement;
  },
};

/* -------------------------------- Commandes -------------------------------- */

export const ordersService = {
  async list() {
    await delay();
    return getState().orders;
  },
  async get(id: ID) {
    await delay();
    return getState().orders.find((o) => o.id === id) ?? null;
  },
  async create(input: {
    customerId: ID;
    customerName: string;
    phone: string;
    communeId: ID;
    zoneId: ID;
    addressDetail: string;
    landmark: string;
    notes: string;
    deliveryFee: number;
    items: Array<Omit<OrderItem, "id">>;
  }) {
    await delay();
    const items: OrderItem[] = input.items.map((it, i) => ({ ...it, id: nextId(`oit${i}`) }));
    const productsTotal = items.reduce((s, it) => s + it.unitPrice * it.quantity - it.discount, 0);
    const state = getState();
    const order: Order = {
      id: nextId("ord"),
      reference: `CMD-2026-${1000 + state.orders.length + 1}`,
      customerId: input.customerId,
      customerName: input.customerName,
      phone: input.phone,
      communeId: input.communeId,
      zoneId: input.zoneId,
      addressDetail: input.addressDetail,
      landmark: input.landmark,
      items,
      productsTotal: Math.round(productsTotal * 100) / 100,
      deliveryFee: input.deliveryFee,
      totalToCollect: Math.round((productsTotal + input.deliveryFee) * 100) / 100,
      paymentState: "non_paye",
      notes: input.notes,
      status: "nouvelle",
      createdAt: now(),
      history: [
        {
          id: nextId("evt"),
          status: "nouvelle",
          note: "Commande enregistrée",
          userName: state.users[0]!.fullName,
          createdAt: now(),
        },
      ],
    };
    setState((s) => ({ ...s, orders: [order, ...s.orders] }));
    log("Création commande", "Order", order.reference);
    return order;
  },
  async updateStatus(id: ID, status: OrderStatus, note = "Statut mis à jour") {
    await delay();
    const state = getState();
    const user = state.users[0]!;
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id !== id
          ? o
          : {
              ...o,
              status,
              paymentState: status === "livree" ? "paye" : o.paymentState,
              history: [
                ...o.history,
                {
                  id: nextId("evt"),
                  status,
                  note,
                  userName: user.fullName,
                  createdAt: now(),
                },
              ],
            },
      ),
      transactions:
        status === "livree"
          ? [
              {
                id: nextId("trx"),
                reference: s.orders.find((o) => o.id === id)!.reference,
                type: "encaissement" as const,
                label: `Encaissement livraison — ${s.orders.find((o) => o.id === id)!.customerName}`,
                amount: s.orders.find((o) => o.id === id)!.totalToCollect,
                direction: "entree" as const,
                createdAt: now(),
              },
              ...s.transactions,
            ]
          : s.transactions,
    }));
    log("Changement de statut commande", "Order", id);
  },
  async assignDriver(id: ID, driverId: ID) {
    await delay();
    const driver = getState().drivers.find((d) => d.id === driverId);
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id !== id
          ? o
          : {
              ...o,
              driverId,
              status: o.status === "livree" ? o.status : "assignee",
              history: [
                ...o.history,
                {
                  id: nextId("evt"),
                  status: "assignee" as OrderStatus,
                  note: `Assignée à ${driver?.fullName ?? "livreur"}`,
                  userName: s.users[0]!.fullName,
                  createdAt: now(),
                },
              ],
            },
      ),
    }));
    log("Assignation livreur", "Order", id);
  },
  async update(id: ID, patch: Partial<Order>) {
    await delay();
    setState((s) => ({ ...s, orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
    log("Modification commande", "Order", id);
  },
  async remove(id: ID) {
    await delay();
    setState((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== id) }));
    log("Suppression commande", "Order", id);
  },
};

/* ---------------------------------- Ventes --------------------------------- */

export const salesService = {
  async list() {
    await delay();
    return getState().sales;
  },
  async create(input: {
    posteId: ID;
    customerId?: ID;
    customerName: string;
    discount: number;
    items: Array<Omit<SaleItem, "id">>;
  }) {
    await delay();
    const state = getState();
    const user = state.users[0]!;
    const items: SaleItem[] = input.items.map((it, i) => ({ ...it, id: nextId(`sit${i}`) }));
    const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity - it.discount, 0);
    const sale: Sale = {
      id: nextId("ven"),
      reference: `POS-2026-${2000 + state.sales.length + 1}`,
      posteId: input.posteId,
      userId: user.id,
      userName: user.fullName,
      customerId: input.customerId,
      customerName: input.customerName,
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: input.discount,
      total: Math.round((subtotal - input.discount) * 100) / 100,
      createdAt: now(),
    };
    setState((s) => ({
      ...s,
      sales: [sale, ...s.sales],
      transactions: [
        {
          id: nextId("trx"),
          reference: sale.reference,
          type: "vente" as const,
          label: `Vente POS — ${sale.customerName}`,
          amount: sale.total,
          direction: "entree" as const,
          createdAt: sale.createdAt,
        },
        ...s.transactions,
      ],
      products: s.products.map((p) => {
        const lines = items.filter((it) => it.productId === p.id);
        if (lines.length === 0) return p;
        return {
          ...p,
          variants: p.variants.map((v) => {
            const line = lines.find((l) => l.variantId === v.id);
            return line
              ? { ...v, stock: Math.max(0, v.stock - line.quantity), sold: v.sold + line.quantity }
              : v;
          }),
        };
      }),
      movements: [
        ...items.map((it) => ({
          id: nextId("mvt"),
          reference: sale.reference,
          productId: it.productId,
          variantId: it.variantId,
          quantity: -it.quantity,
          type: "sortie" as const,
          userId: user.id,
          note: `Vente POS ${sale.reference}`,
          createdAt: sale.createdAt,
        })),
        ...s.movements,
      ],
    }));
    log("Vente POS enregistrée", "Sale", sale.reference);
    return sale;
  },
};

/* --------------------------------- Clients --------------------------------- */

export const customersService = {
  async list() {
    await delay();
    return getState().customers;
  },
  async get(id: ID) {
    await delay();
    return getState().customers.find((c) => c.id === id) ?? null;
  },
  async create(input: Omit<Customer, "id" | "createdAt" | "totalSpent" | "ordersCount" | "regular">) {
    await delay();
    const customer: Customer = {
      ...input,
      id: nextId("cli"),
      totalSpent: 0,
      ordersCount: 0,
      regular: false,
      createdAt: now(),
    };
    setState((s) => ({ ...s, customers: [customer, ...s.customers] }));
    log("Création client", "Customer", customer.fullName);
    return customer;
  },
  async update(id: ID, patch: Partial<Customer>) {
    await delay();
    setState((s) => ({
      ...s,
      customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    log("Modification client", "Customer", id);
  },
  async remove(id: ID) {
    await delay();
    setState((s) => ({ ...s, customers: s.customers.filter((c) => c.id !== id) }));
    log("Suppression client", "Customer", id);
  },
};

/* ------------------------- Fournisseurs & achats --------------------------- */

export const suppliersService = {
  async list() {
    await delay();
    return getState().suppliers;
  },
  async create(input: Omit<Supplier, "id" | "createdAt">) {
    await delay();
    const supplier: Supplier = { ...input, id: nextId("sup"), createdAt: now() };
    setState((s) => ({ ...s, suppliers: [supplier, ...s.suppliers] }));
    log("Création fournisseur", "Supplier", supplier.name);
    return supplier;
  },
  async update(id: ID, patch: Partial<Supplier>) {
    await delay();
    setState((s) => ({
      ...s,
      suppliers: s.suppliers.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
    log("Modification fournisseur", "Supplier", id);
  },
  async remove(id: ID) {
    await delay();
    setState((s) => ({ ...s, suppliers: s.suppliers.filter((x) => x.id !== id) }));
    log("Suppression fournisseur", "Supplier", id);
  },
  /** Réception : ajoute les quantités reçues au stock mocké. */
  async receivePurchaseOrder(purchaseOrderId: ID) {
    await delay();
    const order = getState().purchaseOrders.find((p) => p.id === purchaseOrderId);
    if (!order) return;
    setState((s) => ({
      ...s,
      purchaseOrders: s.purchaseOrders.map((p) =>
        p.id !== purchaseOrderId
          ? p
          : {
              ...p,
              status: "recue",
              receivedAt: now(),
              items: p.items.map((it) => ({ ...it, received: it.quantity })),
            },
      ),
      products: s.products.map((p) => {
        const line = order.items.find((it) => it.productId === p.id);
        if (!line) return p;
        const remaining = line.quantity - line.received;
        if (remaining <= 0) return p;
        return {
          ...p,
          variants: p.variants.map((v, i) =>
            i === 0 ? { ...v, stock: v.stock + remaining } : v,
          ),
        };
      }),
      movements: [
        ...order.items
          .filter((it) => it.quantity - it.received > 0)
          .map((it) => ({
            id: nextId("mvt"),
            reference: order.reference,
            productId: it.productId,
            quantity: it.quantity - it.received,
            type: "entree" as const,
            userId: s.users[0]!.id,
            note: `Réception achat ${order.reference}`,
            createdAt: now(),
          })),
        ...s.movements,
      ],
    }));
    log("Réception marchandise", "PurchaseOrder", order.reference);
  },
};

/* --------------------------------- Finance --------------------------------- */

export const financeService = {
  async addExpense(input: Omit<Expense, "id" | "reference" | "createdAt" | "userId">) {
    await delay();
    const expense: Expense = {
      ...input,
      id: nextId("dep"),
      reference: `DEP-${Math.floor(Math.random() * 9000) + 1000}`,
      userId: getState().users[0]!.id,
      createdAt: now(),
    };
    setState((s) => ({
      ...s,
      expenses: [expense, ...s.expenses],
      transactions: [
        {
          id: nextId("trx"),
          reference: expense.reference,
          type: "depense" as const,
          label: expense.label,
          amount: expense.amount,
          direction: "sortie" as const,
          createdAt: expense.createdAt,
        },
        ...s.transactions,
      ],
    }));
    log("Dépense enregistrée", "Expense", expense.reference);
    return expense;
  },
  async closeCashSession(id: ID, closingAmount: number) {
    await delay();
    setState((s) => ({
      ...s,
      cashSessions: s.cashSessions.map((c) =>
        c.id === id ? { ...c, closingAmount, status: "cloturee", closedAt: now() } : c,
      ),
    }));
    log("Clôture de caisse", "CashSession", id);
  },
};

/* ------------------------------- Utilisateurs ------------------------------ */

export const usersService = {
  async list() {
    await delay();
    return getState().users;
  },
  async create(input: Omit<User, "id" | "createdAt">) {
    await delay();
    const user: User = { ...input, id: nextId("usr"), createdAt: now() };
    setState((s) => ({ ...s, users: [...s.users, user] }));
    log("Création utilisateur", "User", user.email);
    return user;
  },
  async update(id: ID, patch: Partial<User>) {
    await delay();
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
    log("Modification utilisateur", "User", id);
  },
  async remove(id: ID) {
    await delay();
    setState((s) => ({ ...s, users: s.users.filter((u) => u.id !== id) }));
    log("Suppression utilisateur", "User", id);
  },
};

/* ------------------------------ Notifications ------------------------------ */

export const notificationsService = {
  async markAllRead() {
    await delay(80);
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
  },
};

/* -------------------------------- Paramètres ------------------------------- */

export const settingsService = {
  async updateCompany(patch: Partial<import("@/types").CompanySettings>) {
    await delay();
    setState((s) => ({ ...s, company: { ...s.company, ...patch } }));
    log("Modification paramètres", "CompanySettings");
  },
};
