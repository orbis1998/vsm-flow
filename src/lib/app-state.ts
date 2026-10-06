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
  Poste,
  Product,
  PurchaseOrder,
  Sale,
  StockMovement,
  Supplier,
  User,
} from "@/types";

export interface AppState {
  company: CompanySettings;
  postes: Poste[];
  users: User[];
  drivers: DeliveryDriver[];
  categories: Category[];
  brands: Brand[];
  suppliers: Supplier[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  deliveries: Delivery[];
  sales: Sale[];
  movements: StockMovement[];
  driverStock: DriverStockLine[];
  purchaseOrders: PurchaseOrder[];
  expenses: Expense[];
  transactions: FinancialTransaction[];
  cashSessions: CashSession[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  communes: Commune[];
  zones: DeliveryZone[];
}

export const EMPTY_APP_STATE: AppState = {
  company: {
    name: "Business Suite",
    legalName: "",
    phone: "",
    email: "",
    address: "",
    currency: "USD",
    usdCdfRate: 2800,
    defaultDeliveryFee: 0,
    lowStockAlert: true,
    mapboxToken: "",
  },
  postes: [],
  users: [],
  drivers: [],
  categories: [],
  brands: [],
  suppliers: [],
  products: [],
  customers: [],
  orders: [],
  deliveries: [],
  sales: [],
  movements: [],
  driverStock: [],
  purchaseOrders: [],
  expenses: [],
  transactions: [],
  cashSessions: [],
  notifications: [],
  auditLogs: [],
  communes: [],
  zones: [],
};

export const APP_STATE_KEY = ["app-state"] as const;

export function nextId(prefix: string): string {
  const n = Math.floor(Math.random() * 100000);
  return `${prefix}-${Date.now().toString(36)}${n.toString(36)}`;
}
