import type { OrderStatus } from "@/types";

export const CURRENCY = "USD";

export function money(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 2,
  }).format(amount);
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
