import type { DriverStockLine, Product } from "@/types";

export function productStock(p: Product): number {
  return p.variants.reduce((sum, v) => sum + v.stock, 0);
}

export function driverVariantQty(
  lines: DriverStockLine[],
  driverId: string,
  productId: string,
  variantId?: string,
): number {
  const mine = lines.filter((l) => l.driverId === driverId && l.productId === productId);
  const exact = mine
    .filter((l) => (l.variantId ?? "") === (variantId ?? ""))
    .reduce((sum, l) => sum + l.quantity, 0);
  if (exact > 0) return exact;
  const loose = mine.filter((l) => !l.variantId).reduce((sum, l) => sum + l.quantity, 0);
  if (loose > 0) return loose;
  return mine.reduce((sum, l) => sum + l.quantity, 0);
}

export function driverProductQty(lines: DriverStockLine[], driverId: string, productId: string): number {
  return lines
    .filter((l) => l.driverId === driverId && l.productId === productId)
    .reduce((sum, l) => sum + l.quantity, 0);
}

export function productInStock(p: Product): boolean {
  return productStock(p) > 0;
}

export function pickAvailableVariant(p: Product, qty = 1) {
  return p.variants.find((v) => v.stock >= qty) ?? p.variants.find((v) => v.stock > 0);
}

export function productImage(p: Product): string {
  const url = p.imageUrl || p.imageLabel;
  return url.startsWith("data:") || url.startsWith("http") ? url : "";
}
