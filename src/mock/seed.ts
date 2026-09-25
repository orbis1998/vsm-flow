import { COMMUNES, ZONES } from "./geo";
import type {
  AppNotification,
  AuditLog,
  Brand,
  CashSession,
  Category,
  CompanySettings,
  Customer,
  Delivery,
  DeliveryDriver,
  Expense,
  ExpenseCategory,
  FinancialTransaction,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  Poste,
  Product,
  ProductVariant,
  PurchaseOrder,
  Sale,
  StockMovement,
  StockMovementType,
  Supplier,
  Unit,
  User,
} from "@/types";

/**
 * Données de démonstration déterministes.
 * Un PRNG à graine fixe et une date de référence fixe garantissent que le
 * rendu serveur et le rendu client produisent exactement les mêmes données.
 */
export const REFERENCE_NOW = new Date("2026-09-25T17:30:00.000Z");

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260925);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const round2 = (n: number) => Math.round(n * 100) / 100;
const daysAgo = (d: number, hour = 10, minute = 0) => {
  const date = new Date(REFERENCE_NOW);
  date.setUTCDate(date.getUTCDate() - d);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
};
const pad = (n: number, size = 4) => String(n).padStart(size, "0");

/* ------------------------------- Paramètres -------------------------------- */

export const COMPANY: CompanySettings = {
  name: "VSM Collection",
  legalName: "VSM Collection SARL",
  phone: "+243 812 000 145",
  email: "contact@vsmcollection.cd",
  address: "12, av. du Commerce, Gombe, Kinshasa",
  currency: "USD",
  defaultDeliveryFee: 4,
  lowStockAlert: true,
};

export const POSTES: Poste[] = [
  { id: "pos-1", name: "Boutique Gombe", address: "12, av. du Commerce, Gombe", type: "boutique" },
  { id: "pos-2", name: "Boutique Limete", address: "7ème rue, Limete", type: "boutique" },
  { id: "pos-3", name: "Entrepôt Masina", address: "Petro-Congo, Masina", type: "entrepot" },
  { id: "pos-4", name: "Vente mobile livreurs", address: "Terrain", type: "mobile" },
];

/* ------------------------------- Utilisateurs ------------------------------ */

const DRIVER_NAMES = [
  "Patrick Mbala",
  "Josué Kabeya",
  "Éric Ntumba",
  "Blaise Lokole",
  "Fiston Mukendi",
];

export const USERS: User[] = [
  {
    id: "usr-1",
    fullName: "Aroman Emetshu",
    email: "aroman@vsmcollection.cd",
    phone: "+243 812 000 145",
    role: "ADMIN",
    status: "actif",
    posteId: "pos-1",
    extraPermissions: [],
    createdAt: daysAgo(400),
    lastLoginAt: daysAgo(0, 7, 12),
  },
  {
    id: "usr-2",
    fullName: "Sarah Ilunga",
    email: "sarah@vsmcollection.cd",
    phone: "+243 822 114 908",
    role: "GERANT",
    status: "actif",
    posteId: "pos-1",
    extraPermissions: ["finance.manage"],
    createdAt: daysAgo(320),
    lastLoginAt: daysAgo(0, 8, 40),
  },
  {
    id: "usr-3",
    fullName: "Dieudonné Kasongo",
    email: "dieudonne@vsmcollection.cd",
    phone: "+243 899 447 201",
    role: "GERANT",
    status: "actif",
    posteId: "pos-2",
    extraPermissions: [],
    createdAt: daysAgo(210),
    lastLoginAt: daysAgo(1, 17, 5),
  },
  ...DRIVER_NAMES.map((name, i) => ({
    id: `usr-${4 + i}`,
    fullName: name,
    email: `${name.split(" ")[1]!.toLowerCase()}@vsmcollection.cd`,
    phone: `+243 8${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`,
    role: "LIVREUR" as const,
    status: (i === 4 ? "suspendu" : "actif") as User["status"],
    posteId: "pos-4",
    extraPermissions: i < 2 ? (["pos.use"] as User["extraPermissions"]) : [],
    createdAt: daysAgo(180 - i * 12),
    lastLoginAt: daysAgo(i === 4 ? 25 : 0, 9, 10 + i),
  })),
];

export const DRIVERS: DeliveryDriver[] = DRIVER_NAMES.map((name, i) => ({
  id: `drv-${i + 1}`,
  userId: `usr-${4 + i}`,
  fullName: name,
  phone: USERS[3 + i]!.phone,
  vehicle: pick(["Moto Sanili", "Moto Boxer", "Tricycle", "Voiture Toyota IST"]),
  zoneIds: ZONES.filter((_, z) => z % 5 === i).map((z) => z.id),
  active: i !== 4,
  canSell: i < 2,
}));

/* -------------------------------- Catalogue -------------------------------- */

export const CATEGORIES: Category[] = [
  { id: "cat-1", name: "Prêt-à-porter" },
  { id: "cat-2", name: "Chaussures" },
  { id: "cat-3", name: "Accessoires" },
  { id: "cat-4", name: "Cosmétiques" },
  { id: "cat-11", name: "Chemises", parentId: "cat-1" },
  { id: "cat-12", name: "Robes", parentId: "cat-1" },
  { id: "cat-13", name: "Pantalons", parentId: "cat-1" },
  { id: "cat-21", name: "Sneakers", parentId: "cat-2" },
  { id: "cat-22", name: "Escarpins", parentId: "cat-2" },
  { id: "cat-31", name: "Sacs", parentId: "cat-3" },
  { id: "cat-32", name: "Montres", parentId: "cat-3" },
  { id: "cat-41", name: "Soins visage", parentId: "cat-4" },
];

export const BRANDS: Brand[] = [
  { id: "brd-1", name: "VSM Signature" },
  { id: "brd-2", name: "VSM Urban" },
  { id: "brd-3", name: "VSM Luxe" },
  { id: "brd-4", name: "Kin Style" },
  { id: "brd-5", name: "Elegance CD" },
];

export const SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    name: "Guangzhou Textile Export",
    contactName: "Mr. Liu Wei",
    phone: "+86 138 4521 778",
    email: "sales@gz-textile.cn",
    address: "Baiyun District, Guangzhou",
    debt: 4200,
    createdAt: daysAgo(390),
  },
  {
    id: "sup-2",
    name: "Dubai Fashion Trading LLC",
    contactName: "Ahmed Rachid",
    phone: "+971 55 220 118",
    email: "ahmed@dftrading.ae",
    address: "Deira, Dubaï",
    debt: 1850,
    createdAt: daysAgo(340),
  },
  {
    id: "sup-3",
    name: "Kin Wholesale Market",
    contactName: "Mama Nzuzi",
    phone: "+243 815 662 400",
    email: "kinwholesale@gmail.com",
    address: "Marché central, Kinshasa",
    debt: 0,
    createdAt: daysAgo(260),
  },
  {
    id: "sup-4",
    name: "Istanbul Shoes Co.",
    contactName: "Mehmet Özkan",
    phone: "+90 532 118 4420",
    email: "export@istshoes.com.tr",
    address: "Merter, Istanbul",
    debt: 980,
    createdAt: daysAgo(200),
  },
  {
    id: "sup-5",
    name: "Beauty Import Afrique",
    contactName: "Grace Tshibanda",
    phone: "+243 897 004 512",
    email: "grace@beautyimport.cd",
    address: "Limete industriel, Kinshasa",
    debt: 320,
    createdAt: daysAgo(120),
  },
];

const PRODUCT_DEFS: Array<[string, string, string, Unit, number, number]> = [
  ["Chemise VSM Oxford", "cat-11", "brd-1", "pièce", 9, 24],
  ["Chemise lin VSM Été", "cat-11", "brd-2", "pièce", 11, 28],
  ["Robe VSM Élégance", "cat-12", "brd-3", "pièce", 18, 52],
  ["Robe cocktail VSM Noir", "cat-12", "brd-3", "pièce", 22, 65],
  ["Robe pagne VSM Kin", "cat-12", "brd-4", "pièce", 14, 40],
  ["Pantalon chino VSM", "cat-13", "brd-1", "pièce", 12, 32],
  ["Jean slim VSM Urban", "cat-13", "brd-2", "pièce", 13, 35],
  ["Costume VSM Signature", "cat-1", "brd-3", "pièce", 55, 145],
  ["T-shirt VSM Logo", "cat-1", "brd-2", "pièce", 4, 14],
  ["Veste bomber VSM", "cat-1", "brd-2", "pièce", 20, 58],
  ["Sneakers VSM Street", "cat-21", "brd-2", "paire", 17, 45],
  ["Sneakers VSM Air Kin", "cat-21", "brd-2", "paire", 21, 58],
  ["Escarpins VSM Luxe", "cat-22", "brd-3", "paire", 19, 55],
  ["Mocassins VSM Cuir", "cat-2", "brd-1", "paire", 24, 68],
  ["Sandales VSM Été", "cat-2", "brd-4", "paire", 8, 22],
  ["Sac à main VSM Milan", "cat-31", "brd-3", "pièce", 16, 48],
  ["Sac bandoulière VSM", "cat-31", "brd-2", "pièce", 10, 30],
  ["Ceinture cuir VSM", "cat-3", "brd-1", "pièce", 5, 16],
  ["Montre VSM Classic", "cat-32", "brd-3", "pièce", 28, 85],
  ["Montre VSM Sport", "cat-32", "brd-2", "pièce", 18, 52],
  ["Lunettes solaires VSM", "cat-3", "brd-5", "pièce", 6, 20],
  ["Foulard soie VSM", "cat-3", "brd-5", "pièce", 7, 21],
  ["Crème éclaircissante VSM Glow", "cat-41", "brd-5", "pièce", 5, 15],
  ["Huile corporelle VSM Karité", "cat-41", "brd-5", "pièce", 4, 12],
  ["Parfum VSM Nuit", "cat-4", "brd-3", "pièce", 15, 45],
  ["Coffret cadeau VSM", "cat-3", "brd-1", "lot", 30, 78],
];

const SIZES_CLOTHES = ["S", "M", "L", "XL"];
const SIZES_SHOES = ["39", "40", "41", "42", "43"];
const COLORS = ["Noir", "Blanc", "Rouge", "Beige", "Bleu nuit"];

function barcode(seq: number): string {
  return `24300${pad(seq, 7)}`;
}

export const PRODUCTS: Product[] = PRODUCT_DEFS.map(
  ([name, categoryId, brandId, unit, purchase, sale], i) => {
    const id = `prd-${pad(i + 1, 3)}`;
    const sku = `VSM-${categoryId.replace("cat-", "C")}-${pad(i + 1, 3)}`;
    const isShoe = categoryId.startsWith("cat-2");
    const isCosmetic = categoryId.startsWith("cat-4");
    const sizes = isCosmetic ? [undefined] : isShoe ? SIZES_SHOES : SIZES_CLOTHES;
    const colors = isCosmetic ? [undefined] : COLORS.slice(0, int(2, 3));
    const variants: ProductVariant[] = [];
    let seq = 0;
    for (const size of sizes) {
      for (const color of colors) {
        seq += 1;
        variants.push({
          id: `${id}-v${seq}`,
          productId: id,
          sku: `${sku}-${size ?? "U"}${color ? color.slice(0, 2).toUpperCase() : ""}`,
          barcode: barcode(i * 40 + seq),
          size,
          color,
          model: isCosmetic ? "Standard" : undefined,
          stock: int(0, 26),
          reserved: int(0, 4),
          sold: int(2, 40),
        });
      }
    }
    return {
      id,
      name,
      sku,
      barcode: barcode(i * 40),
      categoryId,
      brandId,
      supplierId: isCosmetic ? "sup-5" : isShoe ? "sup-4" : pick(["sup-1", "sup-2", "sup-3"]),
      purchasePrice: purchase,
      salePrice: sale,
      promoPrice: i % 5 === 0 ? round2(sale * 0.85) : undefined,
      minStock: int(6, 18),
      unit,
      description: `${name} — pièce de la collection VSM, finition soignée, disponible en plusieurs déclinaisons.`,
      imageLabel: name
        .split(" ")
        .slice(0, 2)
        .join(" "),
      lotNumber: `LOT-${2026}-${pad(i + 1, 3)}`,
      expiryDate: isCosmetic ? daysAgo(-int(30, 420)) : undefined,
      variants,
      createdAt: daysAgo(300 - i * 5),
    };
  },
);

export function productStock(p: Product): number {
  return p.variants.reduce((s, v) => s + v.stock, 0);
}

/* --------------------------------- Clients --------------------------------- */

const FIRST = [
  "Jean",
  "Marie",
  "Espérance",
  "Gloire",
  "Christian",
  "Nadine",
  "Béatrice",
  "Olivier",
  "Rachel",
  "Serge",
  "Divine",
  "Emmanuel",
  "Chantal",
  "Bienvenu",
  "Sylvie",
  "Franck",
  "Nancy",
  "Hervé",
  "Jeanine",
  "Papy",
];
const LAST = [
  "Mukendi",
  "Kabongo",
  "Nsimba",
  "Tshimanga",
  "Mbuyi",
  "Ilunga",
  "Lukusa",
  "Mavungu",
  "Bolingo",
  "Ngoma",
  "Kayembe",
  "Bope",
  "Masamba",
  "Kazadi",
  "Nzuzi",
  "Mputu",
];

export const CUSTOMERS: Customer[] = Array.from({ length: 34 }, (_, i) => {
  const commune = pick(COMMUNES);
  const zone = pick(ZONES.filter((z) => z.communeId === commune.id));
  const ordersCount = int(1, 9);
  return {
    id: `cli-${pad(i + 1, 3)}`,
    fullName: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
    phone: `+243 8${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`,
    communeId: commune.id,
    zoneId: zone.id,
    address: `n°${int(1, 240)}, av. ${pick(["Kimbangu", "Bongolo", "Tshela", "Luozi", "Kasangulu", "Nzinga"])}`,
    notes: i % 6 === 0 ? "Cliente fidèle, préfère être appelée avant livraison." : "",
    totalSpent: round2(ordersCount * int(25, 120)),
    ordersCount,
    regular: ordersCount >= 5,
    createdAt: daysAgo(int(10, 280)),
  };
});

/* -------------------------------- Commandes -------------------------------- */

const STATUS_POOL: OrderStatus[] = [
  "nouvelle",
  "nouvelle",
  "a_preparer",
  "a_preparer",
  "prete",
  "assignee",
  "en_livraison",
  "en_livraison",
  "livree",
  "livree",
  "livree",
  "livree",
  "echec",
  "retour",
  "annulee",
];

const STATUS_FLOW: OrderStatus[] = [
  "nouvelle",
  "a_preparer",
  "prete",
  "assignee",
  "en_livraison",
  "livree",
];

export const ORDERS: Order[] = Array.from({ length: 38 }, (_, i) => {
  const customer = CUSTOMERS[int(0, CUSTOMERS.length - 1)]!;
  const zone = ZONES.find((z) => z.id === customer.zoneId)!;
  const itemCount = int(1, 3);
  const items: OrderItem[] = Array.from({ length: itemCount }, (_, j) => {
    const product = PRODUCTS[int(0, PRODUCTS.length - 1)]!;
    const variant = pick(product.variants);
    const qty = int(1, 3);
    return {
      id: `oit-${pad(i + 1, 3)}-${j + 1}`,
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.promoPrice ?? product.salePrice,
      discount: j === 0 && i % 7 === 0 ? 2 : 0,
    };
  });
  const productsTotal = round2(
    items.reduce((s, it) => s + it.unitPrice * it.quantity - it.discount, 0),
  );
  const deliveryFee = zone.defaultFee;
  const status = i < 3 ? "nouvelle" : STATUS_POOL[i % STATUS_POOL.length]!;
  const created = daysAgo(i < 6 ? 0 : int(1, 26), int(8, 18), int(0, 59));
  const flowIndex = STATUS_FLOW.indexOf(status);
  const steps = flowIndex >= 0 ? STATUS_FLOW.slice(0, flowIndex + 1) : [...STATUS_FLOW.slice(0, 5), status];
  const history: OrderEvent[] = steps.map((st, k) => ({
    id: `evt-${pad(i + 1, 3)}-${k + 1}`,
    status: st,
    note: k === 0 ? "Commande enregistrée" : `Statut mis à jour`,
    userName: k < 3 ? "Sarah Ilunga" : pick(DRIVER_NAMES),
    createdAt: new Date(new Date(created).getTime() + k * 3600_000).toISOString(),
  }));
  const needsDriver = ["assignee", "en_livraison", "livree", "echec", "retour"].includes(status);
  return {
    id: `ord-${pad(i + 1, 3)}`,
    reference: `CMD-2026-${pad(1000 + i + 1)}`,
    customerId: customer.id,
    customerName: customer.fullName,
    phone: customer.phone,
    communeId: customer.communeId,
    zoneId: customer.zoneId,
    addressDetail: customer.address,
    landmark: pick([
      "En face de la pharmacie Bonheur",
      "À côté de l'école Saint-Joseph",
      "Derrière le marché",
      "Près de l'arrêt de bus",
      "Portail rouge",
    ]),
    items,
    productsTotal,
    deliveryFee,
    totalToCollect: round2(productsTotal + deliveryFee),
    paymentState: status === "livree" ? "paye" : "non_paye",
    notes: i % 5 === 0 ? "Appeler avant d'arriver." : "",
    status,
    driverId: needsDriver ? DRIVERS[i % 4]!.id : undefined,
    createdAt: created,
    history,
  };
});

export const DELIVERIES: Delivery[] = ORDERS.filter((o) => o.driverId).map((o, i) => ({
  id: `liv-${pad(i + 1, 3)}`,
  orderId: o.id,
  driverId: o.driverId!,
  status: o.status as Delivery["status"],
  proof: o.status === "livree" ? "Signature client enregistrée" : undefined,
  collectedAmount: o.status === "livree" ? o.totalToCollect : 0,
  createdAt: o.createdAt,
  closedAt: ["livree", "echec", "retour"].includes(o.status) ? o.history.at(-1)!.createdAt : undefined,
}));

/* ---------------------------------- Ventes --------------------------------- */

export const SALES: Sale[] = Array.from({ length: 26 }, (_, i) => {
  const seller = pick([USERS[1]!, USERS[2]!, USERS[3]!]);
  const itemCount = int(1, 3);
  const items = Array.from({ length: itemCount }, (_, j) => {
    const product = PRODUCTS[int(0, PRODUCTS.length - 1)]!;
    const variant = pick(product.variants);
    const qty = int(1, 2);
    return {
      id: `sit-${pad(i + 1, 3)}-${j + 1}`,
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.promoPrice ?? product.salePrice,
      discount: 0,
    };
  });
  const subtotal = round2(items.reduce((s, it) => s + it.unitPrice * it.quantity, 0));
  const discount = i % 6 === 0 ? 3 : 0;
  const customer = i % 3 === 0 ? pick(CUSTOMERS) : undefined;
  return {
    id: `ven-${pad(i + 1, 3)}`,
    reference: `POS-2026-${pad(2000 + i + 1)}`,
    posteId: seller.posteId ?? "pos-1",
    userId: seller.id,
    userName: seller.fullName,
    customerId: customer?.id,
    customerName: customer?.fullName ?? "Client comptant",
    items,
    subtotal,
    discount,
    total: round2(subtotal - discount),
    createdAt: daysAgo(i < 5 ? 0 : int(1, 20), int(9, 19), int(0, 59)),
  };
});

/* ---------------------------------- Stock ---------------------------------- */

const MOVEMENT_TYPES: StockMovementType[] = [
  "entree",
  "entree",
  "sortie",
  "sortie",
  "transfert",
  "ajustement",
  "inventaire",
  "endommage",
  "perte",
  "expire",
  "retour",
];

export const MOVEMENTS: StockMovement[] = Array.from({ length: 60 }, (_, i) => {
  const product = PRODUCTS[int(0, PRODUCTS.length - 1)]!;
  const type = MOVEMENT_TYPES[i % MOVEMENT_TYPES.length]!;
  const qty = int(1, 25);
  return {
    id: `mvt-${pad(i + 1, 3)}`,
    reference: `MVT-${pad(5000 + i + 1)}`,
    productId: product.id,
    variantId: pick(product.variants).id,
    quantity: ["entree", "retour", "inventaire"].includes(type) ? qty : -qty,
    type,
    userId: pick(USERS).id,
    note: {
      entree: "Réception fournisseur",
      sortie: "Sortie pour commande client",
      transfert: "Transfert entre boutiques",
      ajustement: "Correction après contrôle",
      inventaire: "Écart d'inventaire régularisé",
      endommage: "Article abîmé au transport",
      perte: "Article introuvable en rayon",
      expire: "Produit périmé retiré",
      retour: "Retour client accepté",
    }[type],
    createdAt: daysAgo(int(0, 40), int(8, 18), int(0, 59)),
  };
});

/* --------------------------- Achats fournisseurs --------------------------- */

export const PURCHASE_ORDERS: PurchaseOrder[] = Array.from({ length: 12 }, (_, i) => {
  const supplier = SUPPLIERS[i % SUPPLIERS.length]!;
  const items = Array.from({ length: int(2, 4) }, (_, j) => {
    const product = PRODUCTS[int(0, PRODUCTS.length - 1)]!;
    const qty = int(10, 80);
    const status = i % 4;
    return {
      id: `pit-${pad(i + 1, 3)}-${j + 1}`,
      productId: product.id,
      quantity: qty,
      received: status === 3 ? qty : status === 2 ? Math.floor(qty / 2) : 0,
      unitPurchasePrice: product.purchasePrice,
    };
  });
  const total = round2(items.reduce((s, it) => s + it.quantity * it.unitPurchasePrice, 0));
  const status: PurchaseOrder["status"] = (
    ["envoyee", "brouillon", "partielle", "recue"] as const
  )[i % 4]!;
  return {
    id: `ach-${pad(i + 1, 3)}`,
    reference: `ACH-2026-${pad(3000 + i + 1)}`,
    supplierId: supplier.id,
    status,
    items,
    total,
    paid: status === "recue" ? total : round2(total * 0.4),
    createdAt: daysAgo(int(5, 120)),
    receivedAt: status === "recue" ? daysAgo(int(1, 4)) : undefined,
  };
});

/* --------------------------------- Finance --------------------------------- */

const EXPENSE_DEFS: Array<[string, ExpenseCategory, number]> = [
  ["Carburant motos livreurs", "transport", 120],
  ["Loyer boutique Gombe", "loyer", 850],
  ["Salaires équipe vente", "salaires", 1600],
  ["Publicité Facebook", "marketing", 180],
  ["Sacs et emballages VSM", "fournitures", 95],
  ["Entretien tricycle", "transport", 60],
  ["Électricité et eau", "divers", 140],
  ["Loyer boutique Limete", "loyer", 600],
  ["Impression flyers", "marketing", 75],
  ["Réparation vitrine", "divers", 110],
  ["Transport marchandise port", "transport", 320],
  ["Fournitures bureau", "fournitures", 48],
];

export const EXPENSES: Expense[] = EXPENSE_DEFS.map(([label, category, amount], i) => ({
  id: `dep-${pad(i + 1, 3)}`,
  reference: `DEP-${pad(7000 + i + 1)}`,
  label,
  category,
  amount,
  userId: pick([USERS[0]!, USERS[1]!]).id,
  createdAt: daysAgo(i < 3 ? 0 : int(1, 28), int(8, 17)),
}));

export const TRANSACTIONS: FinancialTransaction[] = [
  ...SALES.map((s) => ({
    id: `trx-v-${s.id}`,
    reference: s.reference,
    type: "vente" as const,
    label: `Vente POS — ${s.customerName}`,
    amount: s.total,
    direction: "entree" as const,
    createdAt: s.createdAt,
  })),
  ...ORDERS.filter((o) => o.status === "livree").map((o) => ({
    id: `trx-e-${o.id}`,
    reference: o.reference,
    type: "encaissement" as const,
    label: `Encaissement livraison — ${o.customerName}`,
    amount: o.totalToCollect,
    direction: "entree" as const,
    createdAt: o.history.at(-1)!.createdAt,
  })),
  ...EXPENSES.map((e) => ({
    id: `trx-d-${e.id}`,
    reference: e.reference,
    type: "depense" as const,
    label: e.label,
    amount: e.amount,
    direction: "sortie" as const,
    createdAt: e.createdAt,
  })),
  ...PURCHASE_ORDERS.filter((p) => p.status === "recue").map((p) => ({
    id: `trx-a-${p.id}`,
    reference: p.reference,
    type: "achat" as const,
    label: `Achat marchandise — ${SUPPLIERS.find((s) => s.id === p.supplierId)!.name}`,
    amount: p.total,
    direction: "sortie" as const,
    createdAt: p.createdAt,
  })),
].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

export const CASH_SESSIONS: CashSession[] = [
  {
    id: "cai-001",
    posteId: "pos-1",
    openedBy: "Sarah Ilunga",
    openingAmount: 100,
    expectedAmount: 640,
    status: "ouverte",
    openedAt: daysAgo(0, 8, 0),
  },
  {
    id: "cai-002",
    posteId: "pos-2",
    openedBy: "Dieudonné Kasongo",
    openingAmount: 80,
    closingAmount: 512,
    expectedAmount: 520,
    status: "cloturee",
    openedAt: daysAgo(1, 8, 0),
    closedAt: daysAgo(1, 19, 30),
  },
  {
    id: "cai-003",
    posteId: "pos-1",
    openedBy: "Sarah Ilunga",
    openingAmount: 100,
    closingAmount: 735,
    expectedAmount: 735,
    status: "cloturee",
    openedAt: daysAgo(2, 8, 0),
    closedAt: daysAgo(2, 19, 15),
  },
];

/* ---------------------- Notifications & journal d'audit --------------------- */

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: "not-1",
    title: "Stock faible",
    message: "7 produits sont sous leur seuil minimum.",
    level: "alerte",
    read: false,
    createdAt: daysAgo(0, 9, 12),
  },
  {
    id: "not-2",
    title: "Livraison échouée",
    message: "CMD-2026-1013 : client injoignable à Kimbanseke.",
    level: "critique",
    read: false,
    createdAt: daysAgo(0, 14, 5),
  },
  {
    id: "not-3",
    title: "Nouvelle commande",
    message: "3 nouvelles commandes attendent une préparation.",
    level: "info",
    read: false,
    createdAt: daysAgo(0, 16, 40),
  },
  {
    id: "not-4",
    title: "Dette fournisseur",
    message: "Guangzhou Textile Export : 4 200 $ à régler.",
    level: "alerte",
    read: true,
    createdAt: daysAgo(2, 11, 0),
  },
  {
    id: "not-5",
    title: "Caisse non clôturée",
    message: "Boutique Gombe : caisse du jour toujours ouverte.",
    level: "info",
    read: true,
    createdAt: daysAgo(1, 20, 0),
  },
];

export const AUDIT_LOGS: AuditLog[] = Array.from({ length: 24 }, (_, i) => {
  const user = pick(USERS);
  const action = pick([
    "Création commande",
    "Modification produit",
    "Assignation livreur",
    "Clôture de caisse",
    "Ajustement stock",
    "Vente POS enregistrée",
    "Réception marchandise",
    "Connexion",
  ]);
  return {
    id: `log-${pad(i + 1, 3)}`,
    userId: user.id,
    userName: user.fullName,
    action,
    entity: pick(["Order", "Product", "StockMovement", "Sale", "CashSession", "User"]),
    entityId: pick(ORDERS).reference,
    createdAt: daysAgo(int(0, 14), int(7, 20), int(0, 59)),
  };
}).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
