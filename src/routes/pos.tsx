import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, ScanLine, Trash2 } from "lucide-react";
import { useAppState } from "@/mock/store";
import { money } from "@/lib/format";
import { salesService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Forbidden, PageHeader } from "@/components/common/ui-bits";
import type { Product } from "@/types";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "Point de vente — VSM Business Suite" },
      { name: "description", content: "Caisse rapide avec recherche, scan de code-barres et ticket." },
      { property: "og:title", content: "Point de vente — VSM Business Suite" },
      { property: "og:description", content: "Caisse rapide avec recherche et scan de code-barres." },
    ],
  }),
  component: PosPage,
});

interface Line { product: Product; variantId: string; qty: number }

function PosPage() {
  const { can, posteId } = useSession();
  const products = useAppState((s) => s.products);
  const postes = useAppState((s) => s.postes);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState("Client comptoir");
  if (!can("pos.use")) return <Forbidden />;

  const price = (p: Product) => p.promoPrice ?? p.salePrice;
  const add = (p: Product) => {
    const v = p.variants.find((x) => x.stock > 0);
    if (!v) { toast.error("Rupture de stock"); return; }
    setCart((c) => {
      const ex = c.find((l) => l.variantId === v.id);
      if (ex) return c.map((l) => (l.variantId === v.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { product: p, variantId: v.id, qty: 1 }];
    });
  };
  const list = products.filter((p) => `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(q.toLowerCase()));
  const subtotal = cart.reduce((s, l) => s + price(l.product) * l.qty, 0);

  const scan = () => {
    const p = products.find((x) => x.barcode === q.trim() || x.sku === q.trim() || x.variants.some((v) => v.barcode === q.trim()));
    if (p) { add(p); setQ(""); } else toast.error("Code introuvable");
  };

  const checkout = async () => {
    if (!cart.length) return;
    const sale = await salesService.create({
      posteId,
      customerName: customer,
      discount,
      items: cart.map((l) => ({ productId: l.product.id, variantId: l.variantId, productName: l.product.name, quantity: l.qty, unitPrice: price(l.product), discount: 0 })),
    });
    toast.success(`Vente ${sale.reference} — ${money(sale.total)}`);
    setCart([]);
    setDiscount(0);
  };

  return (
    <div>
      <PageHeader title="Point de vente" subtitle={postes.find((p) => p.id === posteId)?.name} />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="mb-3 flex gap-2">
            <Input autoFocus placeholder="Rechercher ou scanner un code-barres…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()} />
            <Button variant="outline" onClick={scan}><ScanLine className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => {
              const st = p.variants.reduce((s, v) => s + v.stock, 0);
              return (
                <button key={p.id} onClick={() => add(p)} disabled={st === 0} className="rounded-md border bg-card p-3 text-left transition hover:border-primary disabled:opacity-40">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-sm bg-foreground text-xs font-bold text-background">{p.imageLabel}</div>
                  <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
                  <div className="mt-1 flex justify-between text-xs"><span className="num font-bold text-primary">{money(price(p))}</span><span className="text-muted-foreground">{st} en stock</span></div>
                </button>
              );
            })}
          </div>
        </div>
        <Card className="h-fit rounded-md lg:sticky lg:top-20">
          <CardHeader><CardTitle className="text-base">Ticket</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
            {cart.length === 0 && <p className="text-sm text-muted-foreground">Panier vide.</p>}
            {cart.map((l) => (
              <div key={l.variantId} className="flex items-center gap-2 text-sm">
                <div className="min-w-0 flex-1"><div className="truncate">{l.product.name}</div><div className="num text-xs text-muted-foreground">{money(price(l.product))}</div></div>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCart((c) => c.map((x) => (x.variantId === l.variantId ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}><Minus className="h-3 w-3" /></Button>
                <span className="num w-6 text-center">{l.qty}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCart((c) => c.map((x) => (x.variantId === l.variantId ? { ...x, qty: x.qty + 1 } : x)))}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCart((c) => c.filter((x) => x.variantId !== l.variantId))}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><span>Sous-total</span><span className="num">{money(subtotal)}</span></div>
              <div className="flex items-center justify-between"><span>Remise</span><Input type="number" className="h-8 w-24 text-right" value={discount} onChange={(e) => setDiscount(Math.max(0, +e.target.value))} /></div>
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="num">{money(Math.max(0, subtotal - discount))}</span></div>
            </div>
            <Button className="w-full" size="lg" disabled={!cart.length} onClick={checkout}>Encaisser</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
