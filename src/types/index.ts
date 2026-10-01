// Modèle de données Business Suite.
// Source de vérité partagée par l'UI et la couche Postgres.

export type ID = string;
export type ISODate = string;

/* ------------------------------- Utilisateurs ------------------------------ */

export type RoleCode =
  | "ADMIN"
  | "GERANT"
  | "LIVREUR"
  | "CAISSIER"
  | "MAGASINIER"
  | "COMPTABLE"
  | "RESP_LOGISTIQUE";

export type Permission =
  | "dashboard.view"
  | "orders.view"
  | "orders.manage"
  | "orders.assigned.view"
  | "products.view"
  | "products.manage"
  | "stock.view"
  | "stock.manage"
  | "pos.use"
  | "logistics.view"
  | "logistics.manage"
  | "customers.view"
  | "customers.manage"
  | "suppliers.view"
  | "suppliers.manage"
  | "finance.view"
  | "finance.manage"
  | "reports.view"
  | "users.view"
  | "users.manage"
  | "settings.view"
  | "settings.manage"
  | "driver.space";

export interface Role {
  code: RoleCode;
  label: string;
  description: string;
  permissions: Permission[];
  enabled: boolean;
}

export type UserStatus = "actif" | "suspendu" | "inactif";

export interface User {
  id: ID;
  fullName: string;
  email: string;
  phone: string;
  badge: string;
  role: RoleCode;
  status: UserStatus;
  posteId?: ID | undefined;
  extraPermissions: Permission[];
  createdAt: ISODate;
  lastLoginAt?: ISODate | undefined;
}

export interface AuditLog {
  id: ID;
  userId: ID;
  userName: string;
  action: string;
  entity: string;
  entityId?: ID | undefined;
  createdAt: ISODate;
}

export interface AppNotification {
  id: ID;
  title: string;
  message: string;
  level: "info" | "alerte" | "critique";
  read: boolean;
  createdAt: ISODate;
  userId?: ID | undefined;
  href?: string | undefined;
}

/* --------------------------------- Catalogue -------------------------------- */

export interface Category {
  id: ID;
  name: string;
  parentId?: ID | undefined;
}

export interface Brand {
  id: ID;
  name: string;
}

export interface ProductOption {
  name: string;
  values: string[];
}

export interface ProductVariant {
  id: ID;
  productId: ID;
  sku: string;
  barcode: string;
  size?: string | undefined;
  color?: string | undefined;
  model?: string | undefined;
  options: Record<string, string>;
  stock: number;
  reserved: number;
  sold: number;
}

export type Unit = "pièce" | "paire" | "carton" | "kg" | "lot";

export interface Product {
  id: ID;
  name: string;
  sku: string;
  barcode: string;
  customBarcode?: string | undefined;
  categoryId: ID;
  brandId: ID;
  supplierId: ID;
  purchasePrice: number;
  salePrice: number;
  promoPrice?: number | undefined;
  minStock: number;
  unit: Unit;
  description: string;
  imageLabel: string;
  imageUrl?: string | undefined;
  lotNumber?: string | undefined;
  expiryDate?: ISODate | undefined;
  options: ProductOption[];
  variants: ProductVariant[];
  createdAt: ISODate;
}

/* ----------------------------------- Stock ---------------------------------- */

export type StockMovementType =
  | "entree"
  | "sortie"
  | "transfert"
  | "ajustement"
  | "inventaire"
  | "endommage"
  | "perte"
  | "expire"
  | "retour";

export interface StockMovement {
  id: ID;
  reference: string;
  productId: ID;
  variantId?: ID | undefined;
  quantity: number;
  type: StockMovementType;
  userId: ID;
  note: string;
  createdAt: ISODate;
}

/* --------------------------------- Partenaires ------------------------------ */

export interface Supplier {
  id: ID;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  debt: number;
  createdAt: ISODate;
}

export type PurchaseOrderStatus = "brouillon" | "envoyee" | "partielle" | "recue" | "annulee";

export interface PurchaseItem {
  id: ID;
  productId: ID;
  quantity: number;
  received: number;
  unitPurchasePrice: number;
}

export interface PurchaseOrder {
  id: ID;
  reference: string;
  supplierId: ID;
  status: PurchaseOrderStatus;
  items: PurchaseItem[];
  total: number;
  paid: number;
  createdAt: ISODate;
  receivedAt?: ISODate | undefined;
}

export interface Customer {
  id: ID;
  fullName: string;
  phone: string;
  communeId: ID;
  zoneId: ID;
  address: string;
  notes: string;
  totalSpent: number;
  ordersCount: number;
  regular: boolean;
  createdAt: ISODate;
}

/* -------------------------------- Livraisons -------------------------------- */

export interface Commune {
  id: ID;
  name: string;
}

export interface DeliveryZone {
  id: ID;
  communeId: ID;
  name: string;
  defaultFee: number;
}

export interface DeliveryDriver {
  id: ID;
  userId: ID;
  fullName: string;
  phone: string;
  vehicle: string;
  zoneIds: ID[];
  active: boolean;
  canSell: boolean;
}

/* --------------------------------- Commandes -------------------------------- */

export type OrderStatus =
  | "nouvelle"
  | "a_preparer"
  | "prete"
  | "assignee"
  | "en_livraison"
  | "livree"
  | "echec"
  | "retour"
  | "annulee";

export interface OrderItem {
  id: ID;
  productId: ID;
  variantId?: ID | undefined;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface OrderEvent {
  id: ID;
  status: OrderStatus;
  note: string;
  userName: string;
  createdAt: ISODate;
}

export type PaymentState = "non_paye" | "paye" | "partiel";

export interface Order {
  id: ID;
  reference: string;
  customerId?: ID | undefined;
  customerName: string;
  phone: string;
  communeId: ID;
  zoneId: ID;
  addressDetail: string;
  landmark: string;
  items: OrderItem[];
  productsTotal: number;
  deliveryFee: number;
  totalToCollect: number;
  paymentState: PaymentState;
  notes: string;
  status: OrderStatus;
  driverId?: ID | undefined;
  posteId?: ID | undefined;
  receivedUsd: number;
  receivedCdf: number;
  createdAt: ISODate;
  history: OrderEvent[];
}

export interface Delivery {
  id: ID;
  orderId: ID;
  driverId: ID;
  status: Extract<OrderStatus, "assignee" | "en_livraison" | "livree" | "echec" | "retour">;
  proof?: string | undefined;
  collectedAmount: number;
  createdAt: ISODate;
  closedAt?: ISODate | undefined;
}

/* ----------------------------------- Ventes --------------------------------- */

export interface SaleItem {
  id: ID;
  productId: ID;
  variantId?: ID | undefined;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface Sale {
  id: ID;
  reference: string;
  posteId: ID;
  userId: ID;
  userName: string;
  customerId?: ID | undefined;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  receivedUsd: number;
  receivedCdf: number;
  createdAt: ISODate;
}

/* ---------------------------------- Finance --------------------------------- */

export type ExpenseCategory =
  | "transport"
  | "loyer"
  | "salaires"
  | "marketing"
  | "fournitures"
  | "divers"
  | "restock"
  | "forfait";

export interface Expense {
  id: ID;
  reference: string;
  label: string;
  category: ExpenseCategory;
  amount: number;
  userId: ID;
  createdAt: ISODate;
}

export type FinancialTransactionType =
  | "vente"
  | "encaissement"
  | "depense"
  | "achat"
  | "perte"
  | "retour"
  | "frais_livraison";

export interface FinancialTransaction {
  id: ID;
  reference: string;
  type: FinancialTransactionType;
  label: string;
  amount: number;
  direction: "entree" | "sortie";
  createdAt: ISODate;
}

export interface CashSession {
  id: ID;
  posteId: ID;
  openedBy: string;
  openingAmount: number;
  closingAmount?: number | undefined;
  expectedAmount: number;
  status: "ouverte" | "cloturee";
  openedAt: ISODate;
  closedAt?: ISODate | undefined;
}

/* -------------------------------- Paramètres -------------------------------- */

export interface Poste {
  id: ID;
  name: string;
  address: string;
  type: "boutique" | "entrepot" | "mobile";
}

export interface CompanySettings {
  name: string;
  legalName: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  usdCdfRate: number;
  defaultDeliveryFee: number;
  lowStockAlert: boolean;
}
