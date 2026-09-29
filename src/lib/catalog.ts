import type { Product } from "@/types";

export function productStock(p: Product): number {
  return p.variants.reduce((sum, v) => sum + v.stock, 0);
}
