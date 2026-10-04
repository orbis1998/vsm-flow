import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAppState } from "@/lib/app-store";
import { productImage, productStock } from "@/lib/catalog";
import { moneyUsd } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { fileToJpegDataUrl } from "@/lib/image";
import { AmountInput, toNumber } from "@/lib/amount";
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
import type { Product, ProductOption, Unit } from "@/types";

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
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("pièce");
  const [purchase, setPurchase] = useState("");
  const [sale, setSale] = useState("");
  const [minStock, setMinStock] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [imageUrl, setImageUrl] = useState("");
  const [optionRows, setOptionRows] = useState<Array<{ name: string; raw: string }>>([]);
  const [stocks, setStocks] = useState<Record<string, string>>({});

  const options: ProductOption[] = optionRows
    .map((r) => ({ name: r.name.trim(), values: parseValues(r.raw) }))
    .filter((o) => o.name && o.values.length);
  const combos = useMemo(() => cartesianOptions(options), [optionRows]);

  if (!can("products.view")) return <Forbidden />;

  const list = products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase()));

  const reset = () => {
    setEditing(null);
    setName("");
    setPurchase("");
    setSale("");
    setMinStock("");
    setImageUrl("");
    setOptionRows([]);
    setStocks({});
    setUnit("pièce");
    setCategoryId(categories[0]?.id ?? "");
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setUnit(p.unit);
    setPurchase(p.purchasePrice ? String(p.purchasePrice) : "");
    setSale(p.salePrice ? String(p.salePrice) : "");
    setMinStock(p.minStock ? String(p.minStock) : "");
    setCategoryId(p.categoryId);
    setImageUrl(productImage(p));
    setOptionRows(p.options.map((o) => ({ name: o.name, raw: o.values.join(", ") })));
    const next: Record<string, string> = {};
    for (const v of p.variants) {
      next[JSON.stringify(v.options)] = v.stock ? String(v.stock) : "";
    }
    setStocks(next);
    setOpen(true);
  };

  const save = async () => {
    if (!name) {
      toast.error("Nom requis");
      return;
    }
    const cat = categoryId || categories[0]?.id;
    const brand = editing?.brandId || brands[0]?.id;
    const supplier = editing?.supplierId || suppliers[0]?.id;
    if (!cat || !brand || !supplier) {
      toast.error("Créez d'abord une catégorie dans le catalogue (données de base).");
      return;
    }
    const sku = editing?.sku ?? `ART-${Date.now().toString(36).toUpperCase()}`;
    const variants = combos.map((opts, i) => {
      const key = JSON.stringify(opts);
      const existing = editing?.variants.find((v) => JSON.stringify(v.options) === key);
      return {
        id: existing?.id ?? "",
        productId: editing?.id ?? "",
        sku: existing?.sku ?? `${sku}-${i + 1}`,
        barcode: existing?.barcode ?? `${Date.now()}${i}`,
        options: opts,
        stock: toNumber(stocks[key] ?? ""),
        reserved: existing?.reserved ?? 0,
        sold: existing?.sold ?? 0,
      };
    });
    const payload = {
      name,
      sku,
      barcode: editing?.barcode ?? `${Date.now()}`,
      categoryId: cat,
      brandId: brand,
      supplierId: supplier,
      purchasePrice: toNumber(purchase),
      salePrice: toNumber(sale),
      minStock: toNumber(minStock),
      unit,
      description: editing?.description ?? "",
      imageLabel: name.slice(0, 2).toUpperCase(),
      imageUrl,
      options,
      variants,
    };
    try {
      if (editing) {
        await productsService.update(editing.id, payload);
        toast.success("Article modifié");
      } else {
        await productsService.create(payload);
        toast.success(`${Math.max(variants.length, 1)} variante(s) créée(s)`);
      }
    setOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    }
  };

  return (
    <div>
      <PageHeader
        title="Articles"
        subtitle={`${products.length} références`}
        actions={
          can("products.manage") && (
            <Button onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> Nouvel article
            </Button>
          )
        }
      />
      <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-xs" />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead className="text-right">Vente</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              {can("products.manage") && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((p) => {
              const img = productImage(p);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {img ? (
                        <img src={img} alt="" className="h-10 w-10 rounded-sm object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted text-xs font-semibold">
                          {p.imageLabel.slice(0, 2) || p.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku} · {p.variants.length} var.
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="num text-right">{moneyUsd(p.promoPrice ?? p.salePrice)}</TableCell>
                  <TableCell className={`num text-right ${productStock(p) <= p.minStock ? "text-primary" : ""}`}>
                    {productStock(p)}
                  </TableCell>
                  {can("products.manage") && (
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm(`Supprimer « ${p.name} » ?`)) return;
                          try {
                            await productsService.remove(p.id);
                            toast.success("Article supprimé");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Suppression impossible");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={can("products.manage") ? 4 : 3} className="text-sm text-muted-foreground">
                  Aucun article. Ajoutez le premier.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'article" : "Nouvel article"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Photo</Label>
              <div className="mt-1 flex items-center gap-3">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-16 w-16 rounded-sm object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-sm border text-[10px] text-muted-foreground">
                    Aperçu
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setImageUrl(await fileToJpegDataUrl(file));
                    } catch {
                      toast.error("Image illisible");
                    }
                  }}
                />
              </div>
              {imageUrl && (
                <button type="button" className="mt-1 text-xs text-muted-foreground underline" onClick={() => setImageUrl("")}>
                  Retirer la photo
                </button>
              )}
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
                <AmountInput value={purchase} onValueChange={setPurchase} placeholder="—" />
              </div>
              <div>
                <Label>Prix de vente USD</Label>
                <AmountInput value={sale} onValueChange={setSale} placeholder="—" />
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
                      <AmountInput
                        className="h-8 w-20"
                        value={stocks[key] ?? ""}
                        onValueChange={(raw) => setStocks((s) => ({ ...s, [key]: raw }))}
                        placeholder="—"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>{editing ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
