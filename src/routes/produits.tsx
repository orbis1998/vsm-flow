import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAppState } from "@/mock/store";
import { productStock } from "@/mock/seed";
import { money } from "@/lib/format";
import { productsService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Forbidden, PageHeader } from "@/components/common/ui-bits";

export const Route = createFileRoute("/produits")({
  head: () => ({
    meta: [
      { title: "Produits — VSM Business Suite" },
      { name: "description", content: "Catalogue produits, prix, variantes et codes-barres de VSM Collection." },
      { property: "og:title", content: "Produits — VSM Business Suite" },
      { property: "og:description", content: "Catalogue produits, prix, variantes et codes-barres." },
    ],
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
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", purchasePrice: 0, salePrice: 0, minStock: 5, categoryId: "", stock: 0 });
  if (!can("products.view")) return <Forbidden />;

  const list = products.filter(
    (p) => (cat === "all" || p.categoryId === cat) && `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(q.toLowerCase()),
  );

  const save = async () => {
    if (!form.name || !form.categoryId) return toast.error("Nom et catégorie requis");
    const sku = `VSM-${Math.floor(Math.random() * 90000) + 10000}`;
    await productsService.create({
      name: form.name,
      sku,
      barcode: `620${Date.now().toString().slice(-10)}`,
      categoryId: form.categoryId,
      brandId: brands[0]!.id,
      supplierId: suppliers[0]!.id,
      purchasePrice: form.purchasePrice,
      salePrice: form.salePrice,
      minStock: form.minStock,
      unit: "pièce",
      description: "",
      imageLabel: form.name.slice(0, 2).toUpperCase(),
      variants: [{ id: "", productId: "", sku, barcode: "", stock: form.stock, reserved: 0, sold: 0 }],
    });
    toast.success("Produit créé");
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Produits"
        subtitle={`${products.length} références`}
        actions={can("products.manage") && <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Nouveau produit</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Nom, SKU ou code-barres…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="hidden md:table-cell">Catégorie</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Achat</TableHead>
              <TableHead className="text-right">Vente</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((p) => {
              const st = productStock(p);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-foreground text-xs font-bold text-background">{p.imageLabel}</div>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{p.sku} · {p.variants.length} var.</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{categories.find((c) => c.id === p.categoryId)?.name}</TableCell>
                  <TableCell className="num hidden sm:table-cell text-right">{money(p.purchasePrice)}</TableCell>
                  <TableCell className="num text-right">
                    {p.promoPrice ? <><span className="font-semibold text-primary">{money(p.promoPrice)}</span> <s className="text-xs text-muted-foreground">{money(p.salePrice)}</s></> : money(p.salePrice)}
                  </TableCell>
                  <TableCell className={`num text-right font-semibold ${st <= p.minStock ? "text-primary" : ""}`}>{st}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau produit</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Catégorie</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prix d'achat (USD)</Label><Input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: +e.target.value })} /></div>
              <div><Label>Prix de vente (USD)</Label><Input type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: +e.target.value })} /></div>
              <div><Label>Stock initial</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} /></div>
              <div><Label>Stock minimum</Label><Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: +e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
