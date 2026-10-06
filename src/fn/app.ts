import { createServerFn } from "@tanstack/react-start";
import type {
  CompanySettings,
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

export type ProductCreateInput = Omit<Product, "id" | "createdAt" | "variants"> & {
  variants?: Product["variants"];
};

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

export type SaleCreateInput = {
  posteId: ID;
  customerId?: ID;
  customerName: string;
  discount: number;
  receivedUsd?: number;
  receivedCdf?: number;
  kind?: Sale["kind"];
  items: Array<Omit<SaleItem, "id">>;
};

export type AppMutation =
  | { op: "product.create"; input: ProductCreateInput }
  | { op: "product.update"; id: ID; patch: Partial<Product> }
  | { op: "product.remove"; id: ID }
  | {
      op: "stock.movement";
      input: { productId: ID; variantId?: ID; quantity: number; type: StockMovementType; note: string };
    }
  | {
      op: "stock.driverRestock";
      input: { driverId: ID; productId: ID; variantId?: ID; quantity: number };
    }
  | { op: "order.create"; input: OrderCreateInput }
  | { op: "order.status"; id: ID; status: OrderStatus; note?: string; receivedUsd?: number; receivedCdf?: number }
  | { op: "order.assign"; id: ID; driverId: ID }
  | { op: "order.update"; id: ID; patch: Partial<Order> }
  | { op: "order.remove"; id: ID }
  | { op: "sale.create"; input: SaleCreateInput }
  | { op: "customer.create"; input: Omit<Customer, "id" | "createdAt" | "totalSpent" | "ordersCount" | "regular"> }
  | { op: "customer.update"; id: ID; patch: Partial<Customer> }
  | { op: "customer.remove"; id: ID }
  | { op: "supplier.create"; input: Omit<Supplier, "id" | "createdAt"> }
  | { op: "supplier.update"; id: ID; patch: Partial<Supplier> }
  | { op: "supplier.remove"; id: ID }
  | { op: "purchase.receive"; id: ID }
  | { op: "finance.expense"; input: Omit<Expense, "id" | "reference" | "createdAt" | "userId"> }
  | { op: "finance.closeCash"; id: ID; closingAmount: number }
  | { op: "user.create"; input: Omit<User, "id" | "createdAt" | "lastLoginAt"> & { password: string; vehicle?: string } }
  | { op: "user.update"; id: ID; patch: Partial<User> }
  | { op: "user.remove"; id: ID }
  | { op: "user.password"; id: ID; password: string }
  | { op: "notifications.readAll"; userId?: ID }
  | { op: "settings.company"; patch: Partial<CompanySettings> }
  | { op: "poste.create"; input: { name: string; address: string; type: "boutique" | "entrepot" | "mobile" } }
  | { op: "poste.update"; id: ID; patch: { name?: string; address?: string; type?: "boutique" | "entrepot" | "mobile" } }
  | { op: "poste.remove"; id: ID }
  | { op: "zone.fee"; id: ID; defaultFee: number }
  | { op: "order.collect"; id: ID; receivedUsd: number; receivedCdf: number }
  | { op: "order.items"; id: ID; items: Array<Omit<OrderItem, "id">> };

export const getAppStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const { loadAppState } = await import("@/server/snapshot");
  return loadAppState();
});

function unwrapMutation(raw: unknown, depth = 0): AppMutation {
  if (depth > 8) throw new Error("Requête d'enregistrement invalide.");
  if (!raw || typeof raw !== "object") throw new Error("Requête d'enregistrement invalide.");
  const obj = raw as Record<string, unknown>;
  if (typeof obj.op === "string") {
    const nested = obj.data;
    if (
      nested &&
      typeof nested === "object" &&
      obj.input === undefined &&
      "input" in (nested as object)
    ) {
      return { ...obj, ...(nested as object) } as AppMutation;
    }
    return obj as AppMutation;
  }
  if ("data" in obj) return unwrapMutation(obj.data, depth + 1);
  throw new Error("Requête d'enregistrement invalide.");
}

export const mutateAppFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => data)
  .handler(async (ctx) => {
    const data = unwrapMutation(ctx.data);
    const { withTxn } = await import("@/server/db");
    const m = await import("@/server/mutations");
    return withTxn(async (client) => {
      switch (data.op) {
        case "product.create":
          return m.createProduct(client, data.input);
        case "product.update":
          await m.updateProduct(client, data.id, data.patch);
          return null;
        case "product.remove":
          await m.removeProduct(client, data.id);
          return null;
        case "stock.movement":
          await m.addMovement(client, data.input);
          return null;
        case "stock.driverRestock": {
          const raw = data as { input?: { driverId: ID; productId: ID; variantId?: ID; quantity: number } } & {
            driverId?: ID;
            productId?: ID;
            variantId?: ID;
            quantity?: number;
          };
          const input = raw.input ?? {
            driverId: raw.driverId ?? "",
            productId: raw.productId ?? "",
            variantId: raw.variantId,
            quantity: raw.quantity ?? 0,
          };
          await m.restockDriver(client, input);
          return null;
        }
        case "order.create":
          return m.createOrder(client, data.input);
        case "order.status":
          await m.updateOrderStatus(client, data.id, data.status, data.note ?? "Statut mis à jour", {
            receivedUsd: data.receivedUsd,
            receivedCdf: data.receivedCdf,
          });
          return null;
        case "order.assign":
          await m.assignDriver(client, data.id, data.driverId);
          return null;
        case "order.update":
          await m.updateOrder(client, data.id, data.patch);
          return null;
        case "order.remove":
          await m.removeOrder(client, data.id);
          return null;
        case "sale.create":
          return m.createSale(client, data.input);
        case "customer.create":
          return m.createCustomer(client, data.input);
        case "customer.update":
          await m.updateCustomer(client, data.id, data.patch);
          return null;
        case "customer.remove":
          await m.removeCustomer(client, data.id);
          return null;
        case "supplier.create":
          return m.createSupplier(client, data.input);
        case "supplier.update":
          await m.updateSupplier(client, data.id, data.patch);
          return null;
        case "supplier.remove":
          await m.removeSupplier(client, data.id);
          return null;
        case "purchase.receive":
          await m.receivePurchaseOrder(client, data.id);
          return null;
        case "finance.expense":
          return m.addExpense(client, data.input);
        case "finance.closeCash":
          await m.closeCashSession(client, data.id, data.closingAmount);
          return null;
        case "user.create":
          return m.createUser(client, data.input);
        case "user.update":
          await m.updateUser(client, data.id, data.patch);
          return null;
        case "user.remove":
          await m.removeUser(client, data.id);
          return null;
        case "user.password":
          await m.setUserPassword(client, data.id, data.password);
          return null;
        case "notifications.readAll":
          await m.markAllNotificationsRead(client, data.userId);
          return null;
        case "settings.company":
          await m.updateCompany(client, data.patch);
          return null;
        case "poste.create":
          return m.createPoste(client, data.input);
        case "poste.update":
          await m.updatePoste(client, data.id, data.patch);
          return null;
        case "poste.remove":
          await m.removePoste(client, data.id);
          return null;
        case "zone.fee":
          await m.updateZoneFee(client, data.id, data.defaultFee);
          return null;
        case "order.collect":
          await m.collectOrderPayment(client, data.id, data.receivedUsd, data.receivedCdf);
          return null;
        case "order.items":
          await m.replaceOrderItems(client, data.id, data.items);
          return null;
        default:
          throw new Error("Opération inconnue.");
      }
    });
  });
