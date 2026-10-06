import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useAppState } from "@/lib/app-store";
import { AmountInput, toNumber } from "@/lib/amount";
import { moneyCdf, moneyUsd } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { variantLabel } from "@/lib/variants";
import { productStock } from "@/lib/catalog";
import { salesService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Forbidden, PageHeader } from "@/components/common/ui-bits";
import { isGlobalRole } from "@/lib/boutique";
import type { Product } from "@/types";

export const Route = createFileRoute("/gros")({
  head: () => ({
    meta: [
      { title: `Vente en gros — ${APP_NAME}` },
      { name: "description", content: "Vente en gros : prix unitaire saisi à la main, pièces déduites du stock boutique." },
      { property: "og:title", content: `Vente en gros — ${APP_NAME}` },
      { property: "og:description", content: "Vente en gros depuis le stock de la boutique." },
    ],
  }),
  component: WholesalePage,
});

interface Line {
  product: Product;
  variantId: string;
  qty: number;
  unitPrice: number;
}

function WholesalePage() {
  const { can, posteId, role } = useSession();
  const products = useAppState((s) => s.products);
  const postes = useAppState((s) => s.postes);
  const company = useAppState((s) => s.company);
  const [adminPosteId, setAdminPosteId] = useState(postes[0]?.id ?? "");
  const [customer, setCustomer] = useState("Client gros");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [pieces, setPieces] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [receivedUsd, setReceivedUsd] = useState("");
  const [receivedCdf, setReceivedCdf] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  if (!can("wholesale.use")) return <Forbidden />;

  const tillId = isGlobalRole(role) ? adminPosteId : posteId;
  const till = postes.find((p) => p.id === tillId);
  const selected = products.find((p) => p.id === productId);
  const variants = selected?.variants.filter((v) => v.stock > 0) ?? [];
  const inStock = products.filter((p) => productStock(p) > 0);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const total = Math.max(0, subtotal - toNumber(discount));

  const addLine = () => {
    if (!selected) {
      toast.error("Choisissez un article");
      return;
    }
    const variant = selected.variants.find((v) => v.id === (variantId || variants[0]?.id));
    const qty = Math.max(1, Math.round(toNumber(pieces)));
    const price = toNumber(unitPrice);
    if (!variant) {
      toast.error("Choisissez une variante en stock");
      return;
    }
    if (price <= 0) {
      toast.error("Indiquez le prix unitaire");
      return;
    }
    if (variant.stock < qty) {
      toast.error(`${selected.name} : stock boutique insuffisant (${variant.stock} restant)`);
      return;
    }
    setLines((current) => {
      const existing = current.find((l) => l.variantId === variant.id && l.unitPrice === price);
      if (existing) {
        return current.map((l) =>
          l === existing ? { ...l, qty: l.qty + qty } : l,
        );
      }
      return [...current, { product: selected, variantId: variant.id, qty, unitPrice: price }];
    });
    setProductId("");
    setVariantId("");
    setPieces("1");
    setUnitPrice("");
  };

  const checkout = async () => {
    if (!lines.length || saving) return;
    if (!tillId) {
      toast.error(
        isGlobalRole(role)
          ? "Choisissez la boutique pour cette vente en gros"
          : "Votre compte n'est rattaché à aucune boutique.",
      );
      return;
    }
    setSaving(true);
    try {
      const sale = await salesService.create({
        posteId: tillId,
        customerName: customer.trim() || "Client gros",
        discount: toNumber(discount),
        receivedUsd: toNumber(receivedUsd),
        receivedCdf: toNumber(receivedCdf),
        kind: "gros",
        items: lines.map((l) => ({
          productId: l.product.id,
          variantId: l.variantId,
          productName: l.product.name,
          quantity: l.qty,
          unitPrice: l.unitPrice,
          discount: 0,
        })),
      });
      toast.success(`Vente gros ${sale.reference}`);
      setLines([]);
      setDiscount("");
      setReceivedUsd("");
      setReceivedCdf("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Vente en gros"
        subtitle={till ? `${till.name} · prix unitaire saisi à la main` : "Boutique requise"}
      />
      {isGlobalRole(role) && (
        <div className="mb-4 max-w-sm">
          <Select value={tillId || "none"} onValueChange={(v) => setAdminPosteId(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Boutique" />
            </SelectTrigger>
            <SelectContent>
              {postes.length === 0 && <SelectItem value="none">Aucune boutique</SelectItem>}
              {postes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Ajouter un article</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <Label>Article</Label>
              <Select
                value={productId || undefined}
                onValueChange={(v) => {
                  setProductId(v);
                  const p = products.find((x) => x.id === v);
                  const first = p?.variants.find((x) => x.stock > 0);
                  setVariantId(first?.id ?? "");
                  if (p && !unitPrice) setUnitPrice(String(p.salePrice || ""));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un article" />
                </SelectTrigger>
                <SelectContent>
                  {inStock.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      Aucun article en stock boutique
                    </SelectItem>
                  ) : (
                    inStock.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {productStock(p)} pièces
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Variante</Label>
              <Select value={variantId || undefined} onValueChange={setVariantId} disabled={!productId}>
                <SelectTrigger>
                  <SelectValue placeholder="Variante / taille" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {variantLabel(v.options)} · {v.stock} en stock
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre de pièces</Label>
                <AmountInput value={pieces} onValueChange={setPieces} min={1} />
              </div>
              <div>
                <Label>Prix unitaire (USD)</Label>
                <AmountInput value={unitPrice} onValueChange={setUnitPrice} placeholder="0.00" />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={addLine}>
              Ajouter à la vente
            </Button>
          </CardContent>
        </Card>
        <Card className="h-fit rounded-md lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="text-base">Ticket gros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Client</Label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </div>
            {lines.length === 0 && <p className="text-sm text-muted-foreground">Aucun article.</p>}
            {lines.map((l) => (
              <div key={`${l.variantId}-${l.unitPrice}`} className="flex items-center gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{l.product.name}</div>
                  <div className="num text-xs text-muted-foreground">
                    {l.qty} × {moneyUsd(l.unitPrice)} ·{" "}
                    {variantLabel(l.product.variants.find((v) => v.id === l.variantId)?.options)}
                  </div>
                </div>
                <span className="num shrink-0 font-medium">{moneyUsd(l.unitPrice * l.qty)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setLines((c) => c.filter((x) => x !== l))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span>Sous-total</span>
                <span className="num">{moneyUsd(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Remise</span>
                <AmountInput className="h-8 w-24 text-right" value={discount} onValueChange={setDiscount} placeholder="—" />
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total USD</span>
                <span className="num">{moneyUsd(total)}</span>
              </div>
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
            <Button className="w-full" size="lg" disabled={!lines.length || saving} onClick={() => void checkout()}>
              {saving ? "Enregistrement…" : "Enregistrer la vente"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
