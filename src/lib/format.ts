import type { ExpenseCategory, OrderStatus } from "@/types";

export function money(amount: number, currency: "USD" | "CDF" = "USD"): string {
  if (currency === "CDF") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "CDF",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function moneyUsd(amount: number): string {
  return money(amount, "USD");
}

export function moneyCdf(amount: number): string {
  return money(amount, "CDF");
}

export function num(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function pct(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} %`;
}

export function dateShort(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function kinshasaYmd(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kinshasa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function ymdOf(iso: string): string {
  return kinshasaYmd(new Date(iso));
}

export function addDaysYmd(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return kinshasaYmd(d);
}

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  restock: "Restock / achats",
  salaires: "Salaires personnel",
  loyer: "Loyer",
  forfait: "Forfaits",
  divers: "Dépenses personnelles",
  transport: "Transport",
  marketing: "Marketing",
  fournitures: "Fournitures",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  nouvelle: "Nouvelle",
  a_preparer: "À préparer",
  prete: "Prête",
  assignee: "Assignée",
  en_livraison: "En livraison",
  livree: "Livrée",
  echec: "Échec",
  retour: "Retour",
  annulee: "Annulée",
};

export const ORDER_PIPELINE: OrderStatus[] = ["nouvelle", "a_preparer", "prete", "assignee", "en_livraison", "livree"];

export function nextOrderStatus(current: OrderStatus): OrderStatus | null {
  const i = ORDER_PIPELINE.indexOf(current);
  if (i < 0 || i >= ORDER_PIPELINE.length - 1) return null;
  return ORDER_PIPELINE[i + 1]!;
}

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "nouvelle",
  "a_preparer",
  "prete",
  "assignee",
  "en_livraison",
  "livree",
  "echec",
  "retour",
  "annulee",
];

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
