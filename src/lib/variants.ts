export type ProductOption = { name: string; values: string[] };

export const OPTION_PRESETS: ProductOption[] = [
  { name: "Taille", values: ["XS", "S", "M", "L", "XL", "XXL", "3XL"] },
  { name: "Pointure", values: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"] },
  { name: "Couleur", values: ["Noir", "Blanc", "Rouge", "Bleu", "Beige", "Vert", "Gris", "Marron"] },
  { name: "Matière", values: ["Coton", "Lin", "Cuir", "Polyester", "Laine"] },
  { name: "Style", values: ["Standard", "Slim", "Oversize", "Classique"] },
  { name: "Poids (kg)", values: ["0.25", "0.5", "1", "2", "5", "10", "25"] },
  { name: "Contenance", values: ["100 ml", "250 ml", "500 ml", "1 L", "5 L"] },
  { name: "Longueur", values: ["Court", "Moyen", "Long"] },
  { name: "Conditionnement", values: ["Unité", "Pack 3", "Pack 6", "Carton"] },
  { name: "Modèle", values: ["Standard", "Pro", "Luxe"] },
];

export function parseValues(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function cartesianOptions(options: ProductOption[]): Array<Record<string, string>> {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0);
  if (usable.length === 0) return [{}];
  return usable.reduce<Array<Record<string, string>>>((acc, opt) => {
    if (acc.length === 0) {
      return opt.values.map((value) => ({ [opt.name]: value }));
    }
    return acc.flatMap((row) => opt.values.map((value) => ({ ...row, [opt.name]: value })));
  }, []);
}

export function variantLabel(options: Record<string, string> | undefined): string {
  if (!options) return "Standard";
  const parts = Object.entries(options).map(([, v]) => v);
  return parts.length ? parts.join(" · ") : "Standard";
}
