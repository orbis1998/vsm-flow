import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, ScanLine, Trash2 } from "lucide-react";
import { useAppState } from "@/lib/app-store";
import { productImage } from "@/lib/catalog";
import { AmountInput, toNumber } from "@/lib/amount";
import { moneyCdf, moneyUsd } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { variantLabel } from "@/lib/variants";
import { salesService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Forbidden, PageHeader } from "@/components/common/ui-bits";
import { isGlobalRole } from "@/lib/boutique";
import type { Product, ProductVariant } from "@/types";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: `Point de vente — ${APP_NAME}` },
      { name: "description", content: "Caisse rapide avec recherche, scan de code-barres et ticket." },
      { property: "og:title", content: `Point de vente — ${APP_NAME}` },
      { property: "og:description", content: "Caisse rapide avec recherche et scan de code-barres." },
    ],
  }),
  component: PosPage,
});

interface Line { product: Product; variantId: string; qty: number }

function PosPage() {
  const { can, posteId, role } = useSession();
  const products = useAppState((s) => s.products);
  const postes = useAppState((s) => s.postes);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const company = useAppState((s) => s.company);
  const [receivedUsd, setReceivedUsd] = useState("");
  const [receivedCdf, setReceivedCdf] = useState("");
  const [customer, setCustomer] = useState("Client comptoir");
  const [pick, setPick] = useState<Product | null>(null);
  const [adminPosteId, setAdminPosteId] = useState(postes[0]?.id ?? "");
  if (!can("pos.use")) return <Forbidden />;

  const tillId = isGlobalRole(role) ? adminPosteId : posteId;
  const till = postes.find((p) => p.id === tillId);

  const price = (p: Product) => p.promoPrice ?? p.salePrice;
  const pushLine = (p: Product, v: ProductVariant) => {
    setCart((c) => {
      const ex = c.find((l) => l.variantId === v.id);
      if (ex) return c.map((l) => (l.variantId === v.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { product: p, variantId: v.id, qty: 1 }];
    });
  };
  const add = (p: Product) => {
    const available = p.variants.filter((x) => x.stock > 0);
    if (available.length === 0) {
      toast.error("Rupture de stock");
      return;
    }
    if (available.length === 1) {
      pushLine(p, available[0]!);
      return;
    }
    setPick(p);
  };
  const list = products.filter((p) => `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(q.toLowerCase()));
  const subtotal = cart.reduce((s, l) => s + price(l.product) * l.qty, 0);

  const scan = () => {
    const p = products.find((x) => x.barcode === q.trim() || x.sku === q.trim() || x.variants.some((v) => v.barcode === q.trim()));
    if (p) { add(p); setQ(""); } else toast.error("Code introuvable");
  };

  const total = Math.max(0, subtotal - toNumber(discount));
  const checkout = async () => {
    if (!cart.length) return;
    if (!tillId) {
      toast.error(
        isGlobalRole(role)
          ? "Choisissez la boutique pour enregistrer la vente"
          : "Votre compte n'est rattaché à aucune boutique. Demandez à l'admin de vous assigner.",
      );
      return;
    }
    try {
      const sale = await salesService.create({
        posteId: tillId,
        customerName: customer,
        discount: toNumber(discount),
        receivedUsd: toNumber(receivedUsd),
        receivedCdf: toNumber(receivedCdf),
        items: cart.map((l) => ({ productId: l.product.id, variantId: l.variantId, productName: l.product.name, quantity: l.qty, unitPrice: price(l.product), discount: 0 })),
      });
      toast.success(`Vente ${sale.reference}`);
      setCart([]);
      setDiscount("");
      setReceivedUsd("");
      setReceivedCdf("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Encaissement impossible");
    }
  };

  return (
    <div>
      <PageHeader
        title="Point de vente"
        subtitle={till ? till.name : "Boutique requise pour encaisser"}
      />
      {isGlobalRole(role) && (
        <div className="mb-4 max-w-sm">
          <Select value={tillId || "none"} onValueChange={(v) => setAdminPosteId(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Boutique à encaisser" />
            </SelectTrigger>
            <SelectContent>
              {postes.length === 0 && <SelectItem value="none">Aucune boutique</SelectItem>}
              {postes.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            L'administrateur n'est pas rattaché à une boutique. Choisissez ici le point de vente de cette caisse.
          </p>
        </div>
      )}
      {!till && (
        <p className="mb-3 text-sm text-muted-foreground">
          Aucune boutique rattachée. L'admin crée la boutique dans Paramètres, puis assigne gérant, caissier et livreur dans Équipe.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="mb-3 flex gap-2">
            <Input autoFocus placeholder="Rechercher ou scanner un code-barres…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()} />
            <Button variant="outline" onClick={scan}><ScanLine className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => {
              const st = p.variants.reduce((s, v) => s + v.stock, 0);
              const img = productImage(p);
              return (
                <button key={p.id} onClick={() => add(p)} disabled={st === 0} className="rounded-md border bg-card p-3 text-left transition hover:border-primary disabled:opacity-40">
                  {img ? (
                    <img src={img} alt="" className="mb-2 h-16 w-full rounded-sm object-cover" />
                  ) : (
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-sm bg-foreground text-xs font-bold text-background">{p.imageLabel.slice(0, 2) || p.name.slice(0, 2).toUpperCase()}</div>
                  )}
                  <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
                  <div className="mt-1 flex justify-between text-xs"><span className="num font-bold text-primary">{moneyUsd(price(p))}</span><span className="text-muted-foreground">{st} en stock</span></div>
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
                <div className="min-w-0 flex-1"><div className="truncate">{l.product.name}</div><div className="num text-xs text-muted-foreground">{moneyUsd(price(l.product))} · {variantLabel(l.product.variants.find((v) => v.id === l.variantId)?.options)}</div></div>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCart((c) => c.map((x) => (x.variantId === l.variantId ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}><Minus className="h-3 w-3" /></Button>
                <span className="num w-6 text-center">{l.qty}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCart((c) => c.map((x) => (x.variantId === l.variantId ? { ...x, qty: x.qty + 1 } : x)))}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCart((c) => c.filter((x) => x.variantId !== l.variantId))}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><span>Sous-total</span><span className="num">{moneyUsd(subtotal)}</span></div>
              <div className="flex items-center justify-between"><span>Remise</span><AmountInput className="h-8 w-24 text-right" value={discount} onValueChange={setDiscount} placeholder="—" /></div>
              <div className="flex justify-between text-lg font-bold"><span>Total USD</span><span className="num">{moneyUsd(total)}</span></div>
              <p className="text-xs text-muted-foreground">≈ {moneyCdf(total * (company.usdCdfRate || 2800))}</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <div className="text-xs text-muted-foreground">Reçu USD</div>
                  <AmountInput className="h-9" value={receivedUsd} onValueChange={setReceivedUsd} placeholder="—" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Reçu CDF</div>
                  <AmountInput className="h-9" value={receivedCdf} onValueChange={setReceivedCdf} placeholder="—" />
                </div>
              </div>
            </div>
            <Button className="w-full" size="lg" disabled={!cart.length} onClick={checkout}>Encaisser</Button>
          </CardContent>
        </Card>
      </div>
      <Dialog open={!!pick} onOpenChange={(o) => !o && setPick(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir une variante</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {pick?.variants.map((v) => (
              <Button
                key={v.id}
                variant="outline"
                className="justify-between"
                disabled={v.stock <= 0}
                onClick={() => {
                  pushLine(pick, v);
                  setPick(null);
                }}
              >
                <span>{variantLabel(v.options)}</span>
                <span className="text-xs text-muted-foreground">{v.stock} en stock</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
