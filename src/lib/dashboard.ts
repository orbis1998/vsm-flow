import { boutiqueSales } from "@/lib/boutique";
import { addDaysYmd, EXPENSE_LABEL, ymdOf } from "@/lib/format";
import type { Expense, ExpenseCategory, Order, Poste, PurchaseOrder, Sale } from "@/types";

export type DashRange = 7 | 14 | 30;

export function dayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    timeZone: "Africa/Kinshasa",
  });
}

export function rangeDays(range: DashRange, endOffset = 0): string[] {
  return Array.from({ length: range }, (_, i) => addDaysYmd(i - (range - 1) - endOffset));
}

function inDay(iso: string, ymd: string) {
  return ymdOf(iso) === ymd;
}

export function merchOn(sales: Sale[], orders: Order[], ymd: string) {
  return (
    sales.filter((s) => inDay(s.createdAt, ymd)).reduce((n, s) => n + s.total, 0) +
    orders.filter((o) => o.status === "livree" && inDay(o.createdAt, ymd)).reduce((n, o) => n + o.productsTotal, 0)
  );
}

export function spentOn(expenses: Expense[], purchaseOrders: PurchaseOrder[], ymd: string) {
  return (
    expenses.filter((e) => inDay(e.createdAt, ymd)).reduce((n, e) => n + e.amount, 0) +
    purchaseOrders
      .filter((p) => p.status === "recue" && inDay(p.createdAt, ymd))
      .reduce((n, p) => n + p.total, 0)
  );
}

export function changePct(now: number, prev: number) {
  if (prev === 0) return now === 0 ? 0 : 100;
  return ((now - prev) / prev) * 100;
}

export function compactUsd(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)} k$`;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function byExpenseCat(
  expenses: Expense[],
  purchaseOrders: PurchaseOrder[],
  days: string[],
): Array<{ key: string; label: string; amount: number }> {
  const inRange = (iso: string) => days.includes(ymdOf(iso));
  const byCat = (cat: ExpenseCategory) =>
    expenses.filter((e) => e.category === cat && inRange(e.createdAt)).reduce((n, e) => n + e.amount, 0);
  const restockPo = purchaseOrders
    .filter((p) => p.status === "recue" && inRange(p.createdAt))
    .reduce((n, p) => n + p.total, 0);
  return [
    { key: "restock", label: EXPENSE_LABEL.restock, amount: byCat("restock") + restockPo },
    { key: "salaires", label: EXPENSE_LABEL.salaires, amount: byCat("salaires") },
    { key: "loyer", label: EXPENSE_LABEL.loyer, amount: byCat("loyer") },
    { key: "forfait", label: EXPENSE_LABEL.forfait, amount: byCat("forfait") },
    { key: "divers", label: EXPENSE_LABEL.divers, amount: byCat("divers") },
    { key: "transport", label: EXPENSE_LABEL.transport, amount: byCat("transport") },
    { key: "marketing", label: EXPENSE_LABEL.marketing, amount: byCat("marketing") },
    { key: "fournitures", label: EXPENSE_LABEL.fournitures, amount: byCat("fournitures") },
  ].filter((r) => r.amount > 0);
}

export function boutiqueBars(postes: Poste[], sales: Sale[], days: string[]) {
  return postes
    .map((p) => ({
      name: p.name.length > 16 ? `${p.name.slice(0, 15)}…` : p.name,
      full: p.name,
      ventes: boutiqueSales(sales, p.id)
        .filter((s) => days.includes(ymdOf(s.createdAt)))
        .reduce((n, s) => n + s.total, 0),
    }))
    .sort((a, b) => b.ventes - a.ventes);
}
