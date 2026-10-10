import { orderBookedAt } from "@/lib/dashboard";
import { ymdOf } from "@/lib/format";
import { variantLabel } from "@/lib/variants";
import type { DeliveryDriver, Expense, Order, Poste, Product, Sale } from "@/types";

export type RankedLine = { key: string; label: string; qty: number; amount: number };

export type PeriodFiche = {
  from: string;
  to: string;
  posCount: number;
  posAmount: number;
  deliveredCount: number;
  deliveredAmount: number;
  createdCount: number;
  failedCount: number;
  revenue: number;
  spent: number;
  result: number;
  receivedUsd: number;
  receivedCdf: number;
  feesCdf: number;
  topProducts: RankedLine[];
  topVariants: RankedLine[];
  byDay: Array<{ day: string; pos: number; livraisons: number; total: number }>;
  byDriver: RankedLine[];
  byBoutique: RankedLine[];
};

function inYmdRange(iso: string | undefined, from: string, to: string) {
  if (!iso) return false;
  const ymd = ymdOf(iso);
  return ymd >= from && ymd <= to;
}

function bump(map: Map<string, RankedLine>, key: string, label: string, qty: number, amount: number) {
  const row = map.get(key) ?? { key, label, qty: 0, amount: 0 };
  row.qty += qty;
  row.amount += amount;
  map.set(key, row);
}

function ranked(map: Map<string, RankedLine>, limit = 12) {
  return [...map.values()].sort((a, b) => b.qty - a.qty || b.amount - a.amount).slice(0, limit);
}

export function buildPeriodFiche(input: {
  from: string;
  to: string;
  sales: Sale[];
  orders: Order[];
  products: Product[];
  expenses: Expense[];
  drivers: DeliveryDriver[];
  postes: Poste[];
}): PeriodFiche {
  const { from, to, sales, orders, products, expenses, drivers, postes } = input;
  const salesR = sales.filter((s) => inYmdRange(s.createdAt, from, to));
  const delivered = orders.filter((o) => inYmdRange(orderBookedAt(o), from, to));
  const created = orders.filter((o) => inYmdRange(o.createdAt, from, to));
  const failed = created.filter((o) => o.status === "echec" || o.status === "retour");

  const productsById = new Map(products.map((p) => [p.id, p]));
  const variants = new Map<string, { product: string; label: string }>();
  for (const p of products) {
    for (const v of p.variants) {
      variants.set(v.id, { product: p.name, label: variantLabel(v.options) });
    }
  }

  const topProducts = new Map<string, RankedLine>();
  const topVariants = new Map<string, RankedLine>();
  const addItem = (productId: string, variantId: string | undefined, name: string, qty: number, amount: number) => {
    const product = productsById.get(productId);
    bump(topProducts, productId, product?.name ?? name, qty, amount);
    const meta = variantId ? variants.get(variantId) : undefined;
    const vLabel = meta ? `${meta.product} · ${meta.label}` : name;
    bump(topVariants, variantId || `${productId}:${name}`, vLabel, qty, amount);
  };

  for (const s of salesR) {
    for (const it of s.items) {
      addItem(it.productId, it.variantId, it.productName, it.quantity, it.unitPrice * it.quantity - it.discount);
    }
  }
  for (const o of delivered) {
    for (const it of o.items) {
      addItem(it.productId, it.variantId, it.productName, it.quantity, it.unitPrice * it.quantity - it.discount);
    }
  }

  const days = new Map<string, { day: string; pos: number; livraisons: number; total: number }>();
  const dayRow = (ymd: string) => {
    const row = days.get(ymd) ?? { day: ymd, pos: 0, livraisons: 0, total: 0 };
    days.set(ymd, row);
    return row;
  };
  for (const s of salesR) {
    const row = dayRow(ymdOf(s.createdAt));
    row.pos += s.total;
    row.total += s.total;
  }
  for (const o of delivered) {
    const booked = orderBookedAt(o);
    if (!booked) continue;
    const row = dayRow(ymdOf(booked));
    row.livraisons += o.productsTotal;
    row.total += o.productsTotal;
  }

  const byDriver = new Map<string, RankedLine>();
  for (const o of delivered) {
    if (!o.driverId) continue;
    const name = drivers.find((d) => d.id === o.driverId)?.fullName ?? "Livreur";
    bump(byDriver, o.driverId, name, 1, o.productsTotal);
  }

  const byBoutique = new Map<string, RankedLine>();
  for (const s of salesR) {
    const name = postes.find((p) => p.id === s.posteId)?.name ?? "Boutique";
    bump(byBoutique, s.posteId, name, 1, s.total);
  }
  for (const o of delivered) {
    if (!o.posteId) continue;
    const name = postes.find((p) => p.id === o.posteId)?.name ?? "Boutique";
    bump(byBoutique, o.posteId, name, 1, o.productsTotal);
  }

  const posAmount = salesR.reduce((n, s) => n + s.total, 0);
  const deliveredAmount = delivered.reduce((n, o) => n + o.productsTotal, 0);
  const spent = expenses.filter((e) => inYmdRange(e.createdAt, from, to)).reduce((n, e) => n + e.amount, 0);

  return {
    from,
    to,
    posCount: salesR.length,
    posAmount,
    deliveredCount: delivered.length,
    deliveredAmount,
    createdCount: created.length,
    failedCount: failed.length,
    revenue: posAmount + deliveredAmount,
    spent,
    result: posAmount + deliveredAmount - spent,
    receivedUsd: salesR.reduce((n, s) => n + s.receivedUsd, 0) + delivered.reduce((n, o) => n + o.receivedUsd, 0),
    receivedCdf: salesR.reduce((n, s) => n + s.receivedCdf, 0) + delivered.reduce((n, o) => n + o.receivedCdf, 0),
    feesCdf: delivered.reduce((n, o) => n + o.deliveryFee, 0),
    topProducts: ranked(topProducts),
    topVariants: ranked(topVariants),
    byDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byDriver: ranked(byDriver, 10),
    byBoutique: ranked(byBoutique, 10),
  };
}
