import { productStock } from "@/lib/catalog";
import { ROLES } from "@/lib/roles";
import type { Order, Poste, Product, RoleCode, Sale, User } from "@/types";

export const POSTE_TYPE_LABEL: Record<Poste["type"], string> = {
  boutique: "Point de vente",
  entrepot: "Entrepôt",
  mobile: "Caisse mobile",
};

export function isGlobalRole(role: RoleCode) {
  return role === "ADMIN";
}

export function seesAllBoutiques(role: RoleCode) {
  return role === "ADMIN" || role === "COMPTABLE" || role === "RESP_LOGISTIQUE";
}

export function scopedOrders(
  orders: Order[],
  users: User[],
  drivers: { id: string; userId: string }[],
  role: RoleCode,
  posteId?: string,
) {
  if (seesAllBoutiques(role) || !posteId) return orders;
  const driverIds = drivers.filter((d) => users.some((u) => u.id === d.userId && u.posteId === posteId)).map((d) => d.id);
  return boutiqueOrders(orders, posteId, driverIds);
}

export function scopedSales(sales: Sale[], role: RoleCode, posteId?: string) {
  if (seesAllBoutiques(role) || !posteId) return sales;
  return boutiqueSales(sales, posteId);
}

export function teamOf(users: User[], posteId: string) {
  return users.filter((u) => u.posteId === posteId && u.role !== "ADMIN" && u.status === "actif");
}

export function roleCounts(users: User[], posteId: string) {
  const team = teamOf(users, posteId);
  const count = (role: RoleCode) => team.filter((u) => u.role === role).length;
  return {
    gerants: count("GERANT"),
    caissiers: count("CAISSIER"),
    livreurs: count("LIVREUR"),
    magisiniers: count("MAGASINIER"),
    team,
  };
}

export function boutiqueOrders(orders: Order[], posteId: string, driverIds: string[]) {
  return orders.filter((o) => o.posteId === posteId || (o.driverId && driverIds.includes(o.driverId)));
}

export function boutiqueSales(sales: Sale[], posteId: string) {
  return sales.filter((s) => s.posteId === posteId);
}

export function stockSummary(products: Product[]) {
  const units = products.reduce((n, p) => n + productStock(p), 0);
  const low = products.filter((p) => productStock(p) <= p.minStock).length;
  return { units, low, articles: products.length };
}

export function teamLine(users: User[], posteId: string) {
  const { gerants, caissiers, livreurs, magisiniers } = roleCounts(users, posteId);
  const parts: string[] = [];
  if (gerants) parts.push(`${gerants} gérant${gerants > 1 ? "s" : ""}`);
  if (caissiers) parts.push(`${caissiers} caisse`);
  if (livreurs) parts.push(`${livreurs} livreur${livreurs > 1 ? "s" : ""}`);
  if (magisiniers) parts.push(`${magisiniers} stock`);
  return parts.join(" · ") || "Personne rattaché pour l'instant";
}

export function roleLabel(role: RoleCode) {
  return ROLES[role]?.label ?? role;
}
