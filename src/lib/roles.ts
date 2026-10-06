import type { Permission, Role, RoleCode } from "@/types";

const ALL: Permission[] = [
  "dashboard.view",
  "orders.view",
  "orders.manage",
  "orders.assigned.view",
  "products.view",
  "products.manage",
  "stock.view",
  "stock.manage",
  "pos.use",
  "logistics.view",
  "logistics.manage",
  "customers.view",
  "customers.manage",
  "suppliers.view",
  "suppliers.manage",
  "finance.view",
  "finance.manage",
  "reports.view",
  "users.view",
  "users.manage",
  "settings.view",
  "settings.manage",
  "driver.space",
  "wholesale.use",
];

export const ROLES: Record<RoleCode, Role> = {
  ADMIN: {
    code: "ADMIN",
    label: "Administrateur",
    description: "Accès total à toutes les sections et à la configuration.",
    permissions: ALL.filter((p) => p !== "driver.space" && p !== "orders.assigned.view"),
    enabled: true,
  },
  GERANT: {
    code: "GERANT",
    label: "Gérant",
    description: "Gestion opérationnelle : commandes, stock, POS, clients, logistique.",
    permissions: [
      "dashboard.view",
      "orders.view",
      "orders.manage",
      "products.view",
      "products.manage",
      "stock.view",
      "stock.manage",
      "pos.use",
      "wholesale.use",
      "logistics.view",
      "logistics.manage",
      "customers.view",
      "customers.manage",
      "suppliers.view",
      "suppliers.manage",
      "finance.view",
      "reports.view",
      "users.view",
      "settings.view",
      "settings.manage",
    ],
    enabled: true,
  },
  LIVREUR: {
    code: "LIVREUR",
    label: "Livreur",
    description: "Courses assignées et stock emporté.",
    permissions: ["orders.assigned.view", "driver.space", "stock.view"],
    enabled: true,
  },
  CAISSIER: {
    code: "CAISSIER",
    label: "Caissier",
    description: "Ventes au comptoir et clôture de caisse.",
    permissions: ["pos.use", "wholesale.use", "customers.view", "dashboard.view"],
    enabled: true,
  },
  MAGASINIER: {
    code: "MAGASINIER",
    label: "Magasinier",
    description: "Stock, entrées/sorties et inventaires.",
    permissions: ["stock.view", "stock.manage", "products.view", "dashboard.view"],
    enabled: true,
  },
  COMPTABLE: {
    code: "COMPTABLE",
    label: "Comptable",
    description: "Finance, dépenses, rapports.",
    permissions: ["finance.view", "finance.manage", "reports.view", "dashboard.view"],
    enabled: true,
  },
  RESP_LOGISTIQUE: {
    code: "RESP_LOGISTIQUE",
    label: "Responsable logistique",
    description: "Suivi et assignation des livraisons.",
    permissions: ["logistics.view", "logistics.manage", "orders.view", "dashboard.view"],
    enabled: true,
  },
};

export const ROLE_LIST = Object.values(ROLES);

export function homePath(role: RoleCode): string {
  if (role === "LIVREUR") return "/livreur";
  if (role === "CAISSIER") return "/pos";
  if (role === "MAGASINIER") return "/stock";
  if (role === "COMPTABLE") return "/finance";
  if (role === "RESP_LOGISTIQUE") return "/logistique";
  return "/";
}

export const ROUTE_PERMISSION: Array<{ path: string; perm: Permission }> = [
  { path: "/", perm: "dashboard.view" },
  { path: "/commandes", perm: "orders.view" },
  { path: "/pos", perm: "pos.use" },
  { path: "/gros", perm: "wholesale.use" },
  { path: "/produits", perm: "products.view" },
  { path: "/stock", perm: "stock.view" },
  { path: "/logistique", perm: "logistics.view" },
  { path: "/livreur", perm: "driver.space" },
  { path: "/clients", perm: "customers.view" },
  { path: "/fournisseurs", perm: "suppliers.view" },
  { path: "/finance", perm: "finance.view" },
  { path: "/rapports", perm: "reports.view" },
  { path: "/utilisateurs", perm: "users.view" },
  { path: "/parametres", perm: "settings.view" },
];

export function canOpenPath(role: RoleCode, extra: Permission[], pathname: string): boolean {
  const perms = new Set([...ROLES[role].permissions, ...extra]);
  if (pathname === "/") return perms.has("dashboard.view");
  const hit = ROUTE_PERMISSION.find((r) => r.path !== "/" && (pathname === r.path || pathname.startsWith(`${r.path}/`)));
  if (!hit) return true;
  return perms.has(hit.perm);
}
