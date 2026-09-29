import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAppState } from "@/lib/app-store";
import { productStock } from "@/lib/catalog";
import { moneyUsd } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { cartesianOptions, OPTION_PRESETS, parseValues, variantLabel } from "@/lib/variants";
import { productsService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Forbidden, PageHeader } from "@/components/common/ui-bits";
import type { ProductOption, Unit } from "@/types";

export const Route = createFileRoute("/produits")({
  head: () => ({
    meta: [{ title: `Articles — ${APP_NAME}` }, { name: "description", content: "Catalogue et variantes." }],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { can } = useSession();
  const products = useAppState((s) => s.products);
  const categories = useAppState((s) => s.categories);
  const brands = useAppState((s) => s.brands);
  const suppliers = useAppState((s) => s.suppliers);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("pièce");
  const [purchase, setPurchase] = useState(0);
  const [sale, setSale] = useState(0);
  const [minStock, setMinStock] = useState(5);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [optionRows, setOptionRows] = useState<Array<{ name: string; raw: string }>>([]);
  const [stocks, setStocks] = useState<Record<string, number>>({});

  const options: ProductOption[] = optionRows
    .map((r) => ({ name: r.name.trim(), values: parseValues(r.raw) }))
    .filter((o) => o.name && o.values.length);
  const combos = useMemo(() => cartesianOptions(options), [optionRows]);

  if (!can("products.view")) return <Forbidden />;

  const list = products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    if (!name) {
      toast.error("Nom requis");
      return;
    }
    const cat = categoryId || categories[0]?.id;
    const brand = brands[0]?.id;
    const supplier = suppliers[0]?.id;
    if (!cat || !brand || !supplier) {
      toast.error("Créez d'abord une catégorie dans le catalogue (données de base).");
      return;
    }
    const sku = `ART-${Date.now().toString(36).toUpperCase()}`;
    const variants = combos.map((opts, i) => {
      const key = JSON.stringify(opts);
      return {
        id: "",
        productId: "",
        sku: `${sku}-${i + 1}`,
        barcode: `${Date.now()}${i}`,
        options: opts,
        stock: stocks[key] ?? 0,
        reserved: 0,
        sold: 0,
      };
    });
    await productsService.create({
      name,
      sku,
      barcode: `${Date.now()}`,
      categoryId: cat,
      brandId: brand,
      supplierId: supplier,
      purchasePrice: purchase,
      salePrice: sale,
      minStock,
      unit,
      description: "",
      imageLabel: name.slice(0, 2).toUpperCase(),
      options,
      variants,
    });
    toast.success(`${variants.length} variante(s) créée(s)`);
    setOpen(false);
    setName("");
    setOptionRows([]);
    setStocks({});
  };

  return (
    <div>
      <PageHeader
        title="Articles"
        subtitle={`${products.length} références`}
        actions={
          can("products.manage") && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nouvel article
            </Button>
          )
        }
      />
      <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-xs" />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead className="text-right">Vente</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.sku} · {p.variants.length} var.
                  </div>
                </TableCell>
                <TableCell className="num text-right">{moneyUsd(p.promoPrice ?? p.salePrice)}</TableCell>
                <TableCell className={`num text-right ${productStock(p) <= p.minStock ? "text-primary" : ""}`}>
                  {productStock(p)}
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-sm text-muted-foreground">
                  Aucun article. Ajoutez le premier.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvel article</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unité</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["pièce", "paire", "carton", "kg", "lot"] as Unit[]).map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prix d'achat USD</Label>
                <Input type="number" value={purchase} onChange={(e) => setPurchase(+e.target.value)} />
              </div>
              <div>
                <Label>Prix de vente USD</Label>
                <Input type="number" value={sale} onChange={(e) => setSale(+e.target.value)} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Variantes (comme Shopify)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setOptionRows((r) => [...r, { name: "", raw: "" }])}
                >
                  Option
                </Button>
              </div>
              <div className="mb-2 flex flex-wrap gap-1">
                {OPTION_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="rounded-full border px-2 py-0.5 text-[11px]"
                    onClick={() => setOptionRows((r) => [...r, { name: p.name, raw: p.values.join(", ") }])}
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
              {optionRows.map((row, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    placeholder="Ex. Taille"
                    value={row.name}
                    onChange={(e) =>
                      setOptionRows((r) => r.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <Input
                    placeholder="S, M, L"
                    value={row.raw}
                    onChange={(e) =>
                      setOptionRows((r) => r.map((x, j) => (j === i ? { ...x, raw: e.target.value } : x)))
                    }
                  />
                  <Button type="button" size="icon" variant="ghost" onClick={() => setOptionRows((r) => r.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{combos.length} combinaison(s). Stock par variante :</p>
              <div className="mt-2 max-h-40 space-y-1 overflow-auto">
                {combos.map((c) => {
                  const key = JSON.stringify(c);
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{variantLabel(c)}</span>
                      <Input
                        className="h-8 w-20"
                        type="number"
                        value={stocks[key] ?? 0}
                        onChange={(e) => setStocks((s) => ({ ...s, [key]: +e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
