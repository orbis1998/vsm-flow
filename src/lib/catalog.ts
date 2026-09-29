import type { Product } from "@/types";

export function productStock(p: Product): number {
  return p.variants.reduce((sum, v) => sum + v.stock, 0);
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
