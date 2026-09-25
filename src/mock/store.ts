import { useSyncExternalStore } from "react";
import {
  AUDIT_LOGS,
  BRANDS,
  CASH_SESSIONS,
  CATEGORIES,
  COMPANY,
  CUSTOMERS,
  DELIVERIES,
  DRIVERS,
  EXPENSES,
  MOVEMENTS,
  NOTIFICATIONS,
  ORDERS,
  POSTES,
  PRODUCTS,
  PURCHASE_ORDERS,
  SALES,
  SUPPLIERS,
  TRANSACTIONS,
  USERS,
} from "./seed";
import { COMMUNES, ZONES } from "./geo";
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
  purchaseOrders: PurchaseOrder[];
  expenses: Expense[];
  transactions: FinancialTransaction[];
  cashSessions: CashSession[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  communes: Commune[];
  zones: DeliveryZone[];
}

const initialState: AppState = {
  company: COMPANY,
  postes: POSTES,
  users: USERS,
  drivers: DRIVERS,
  categories: CATEGORIES,
  brands: BRANDS,
  suppliers: SUPPLIERS,
  products: PRODUCTS,
  customers: CUSTOMERS,
  orders: ORDERS,
  deliveries: DELIVERIES,
  sales: SALES,
  movements: MOVEMENTS,
  purchaseOrders: PURCHASE_ORDERS,
  expenses: EXPENSES,
  transactions: TRANSACTIONS,
  cashSessions: CASH_SESSIONS,
  notifications: NOTIFICATIONS,
  auditLogs: AUDIT_LOGS,
  communes: COMMUNES,
  zones: ZONES,
};

let state: AppState = initialState;
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(updater: (current: AppState) => AppState): void {
  state = updater(state);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Lecture réactive d'une tranche de l'état mock. */
export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(initialState),
  );
}

export function nextId(prefix: string): string {
  const n = Math.floor(Math.random() * 100000);
  return `${prefix}-${Date.now().toString(36)}${n.toString(36)}`;
}
