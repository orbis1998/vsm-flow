import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppState } from "@/lib/app-store";
import { productStock } from "@/lib/catalog";
import { AmountInput, toNumber } from "@/lib/amount";
import { dateTime, money, num } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { stockService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, Forbidden, PageHeader, StatCard } from "@/components/common/ui-bits";
import type { DriverStockLine, Product, ProductVariant, StockMovementType } from "@/types";

export const Route = createFileRoute("/stock")({
  head: () => ({
    meta: [
      { title: `Stock — ${APP_NAME}` },
      { name: "description", content: "Niveaux de stock, alertes et mouvements d'entrée et de sortie." },
      { property: "og:title", content: `Stock — ${APP_NAME}` },
      { property: "og:description", content: "Niveaux de stock, alertes et mouvements." },
    ],
  }),
  component: StockPage,
});

const TYPES: Array<[StockMovementType, string, 1 | -1]> = [
  ["entree", "Entrée", 1],
  ["sortie", "Sortie", -1],
  ["ajustement", "Ajustement +", 1],
  ["endommage", "Endommagé", -1],
  ["perte", "Perte", -1],
  ["expire", "Expiré", -1],
  ["retour", "Retour client", 1],
];

function variantLabel(v: ProductVariant) {
  const bits = [v.size, v.color, v.model, ...Object.values(v.options ?? {})].filter(Boolean);
  return bits.length ? bits.join(" · ") : v.sku;
}

function lineLabel(products: Product[], line: DriverStockLine) {
  const product = products.find((p) => p.id === line.productId);
  const variant = product?.variants.find((v) => v.id === line.variantId);
  const extra = variant ? variantLabel(variant) : "";
  return extra ? `${product?.name ?? "Article"} · ${extra}` : (product?.name ?? "Article");
}

function DriverStockView() {
  const { user } = useSession();
  const drivers = useAppState((s) => s.drivers);
  const products = useAppState((s) => s.products);
  const driverStock = useAppState((s) => s.driverStock ?? []);
  const driver = drivers.find((d) => d.userId === user.id) ?? drivers.find((d) => d.fullName === user.fullName);
  const mine = driverStock.filter((l) => driver && l.driverId === driver.id && l.quantity > 0);
  const units = mine.reduce((s, l) => s + l.quantity, 0);

  return (
    <div>
      <PageHeader title="Mon stock" subtitle="Articles emportés depuis votre boutique" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Unités emportées" value={num(units)} />
        <StatCard label="Références" value={num(mine.length)} />
      </div>
      <div className="mt-6 overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mine.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{lineLabel(products, line)}</TableCell>
                <TableCell className="num text-right font-semibold">{line.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {mine.length === 0 && (
          <Empty>Aucun stock emporté. L'admin dote le livreur depuis l'onglet Livreurs de la page Stock.</Empty>
        )}
      </div>
    </div>
  );
}

function StockPage() {
  const { can, role } = useSession();
  const products = useAppState((s) => s.products);
  const movements = useAppState((s) => s.movements);
  const drivers = useAppState((s) => s.drivers);
  const users = useAppState((s) => s.users);
  const postes = useAppState((s) => s.postes);
  const driverStock = useAppState((s) => s.driverStock ?? []);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [type, setType] = useState<StockMovementType>("entree");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [driverId, setDriverId] = useState("");
  const [dotProductId, setDotProductId] = useState("");
  const [dotVariantId, setDotVariantId] = useState("");
  const [dotQty, setDotQty] = useState("");
  const [dotBusy, setDotBusy] = useState(false);

  const driverPoste = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of drivers) {
      const u = users.find((x) => x.id === d.userId);
      const poste = u?.posteId ? postes.find((p) => p.id === u.posteId) : undefined;
      if (poste) map.set(d.id, poste.name);
    }
    return map;
  }, [drivers, users, postes]);

  if (!can("stock.view")) return <Forbidden />;
  if (role === "LIVREUR") return <DriverStockView />;

  const value = products.reduce((s, p) => s + productStock(p) * p.purchasePrice, 0);
  const low = products.filter((p) => productStock(p) <= p.minStock);
  const units = products.reduce((s, p) => s + productStock(p), 0);
  const selected = products.find((p) => p.id === productId);
  const dotProduct = products.find((p) => p.id === dotProductId);
  const allocated = driverStock.filter((l) => l.quantity > 0);
  const activeDrivers = drivers.filter((d) => d.active);

  const submit = async () => {
    const quantity = Math.round(toNumber(qty));
    if (!productId || quantity <= 0) {
      toast.error("Produit et quantité requis");
      return;
    }
    const sign = TYPES.find((t) => t[0] === type)![2];
    await stockService.addMovement({
      productId,
      variantId: variantId || undefined,
      type,
      quantity: sign * quantity,
      note,
    });
    toast.success("Mouvement enregistré");
    setQty("");
    setNote("");
  };

  const restock = async () => {
    const quantity = Math.round(toNumber(dotQty));
    if (!driverId || !dotProductId || quantity <= 0) {
      toast.error("Livreur, article et quantité requis");
      return;
    }
    setDotBusy(true);
    try {
      await stockService.restockDriver({
        driverId,
        productId: dotProductId,
        variantId: dotVariantId || undefined,
        quantity,
      });
      toast.success("Stock remis au livreur");
      setDotQty("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dotation impossible");
    } finally {
      setDotBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Stock" subtitle="Niveaux, alertes, mouvements et dotation livreurs" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Valeur du stock" value={money(value)} hint="au prix d'achat" accent />
        <StatCard label="Unités en stock" value={num(units)} />
        <StatCard label="Sous le seuil" value={num(low.length)} />
      </div>
      <Tabs defaultValue="niveaux" className="mt-6">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="niveaux">Niveaux</TabsTrigger>
          <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
          <TabsTrigger value="livreurs">Livreurs</TabsTrigger>
          {can("stock.manage") && <TabsTrigger value="saisie">Saisir</TabsTrigger>}
        </TabsList>
        <TabsContent value="niveaux">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Réservé</TableHead>
                  <TableHead className="text-right">Seuil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...products]
                  .sort((a, b) => productStock(a) - a.minStock - (productStock(b) - b.minStock))
                  .map((p) => {
                    const st = productStock(p);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className={`num text-right font-semibold ${st <= p.minStock ? "text-primary" : ""}`}>
                          {st}
                        </TableCell>
                        <TableCell className="num text-right">{p.variants.reduce((s, v) => s + v.reserved, 0)}</TableCell>
                        <TableCell className="num text-right text-muted-foreground">{p.minStock}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="mouvements">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.slice(0, 80).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-xs">{dateTime(m.createdAt)}</TableCell>
                    <TableCell>
                      <div>{products.find((p) => p.id === m.productId)?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{m.note}</div>
                    </TableCell>
                    <TableCell className="capitalize">{m.type}</TableCell>
                    <TableCell className={`num text-right font-semibold ${m.quantity < 0 ? "text-primary" : ""}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="livreurs">
          {can("stock.manage") && (
            <div className="mb-6 grid max-w-lg gap-3">
              <p className="text-sm text-muted-foreground">
                La quantité est retirée du stock boutique du poste assigné au livreur.
              </p>
              <div>
                <Label>Livreur</Label>
                <Select value={driverId} onValueChange={setDriverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un livreur" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDrivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.fullName}
                        {driverPoste.get(d.id) ? ` · ${driverPoste.get(d.id)}` : " · sans boutique"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Article</Label>
                <Select
                  value={dotProductId}
                  onValueChange={(v) => {
                    setDotProductId(v);
                    setDotVariantId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({productStock(p)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {dotProduct && dotProduct.variants.length > 0 && (
                <div>
                  <Label>Variante</Label>
                  <Select value={dotVariantId} onValueChange={setDotVariantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Taille / couleur" />
                    </SelectTrigger>
                    <SelectContent>
                      {dotProduct.variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {variantLabel(v)} ({v.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Quantité</Label>
                <AmountInput value={dotQty} onValueChange={setDotQty} />
              </div>
              <Button onClick={() => void restock()} className="w-fit" disabled={dotBusy}>
                {dotBusy ? "Envoi…" : "Remettre le stock"}
              </Button>
            </div>
          )}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Livreur</TableHead>
                  <TableHead>Boutique</TableHead>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocated.map((line) => {
                  const driver = drivers.find((d) => d.id === line.driverId);
                  return (
                    <TableRow key={line.id}>
                      <TableCell>{driver?.fullName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{driverPoste.get(line.driverId) ?? "—"}</TableCell>
                      <TableCell>{lineLabel(products, line)}</TableCell>
                      <TableCell className="num text-right font-semibold">{line.quantity}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {allocated.length === 0 && <Empty>Aucun stock chez les livreurs pour le moment.</Empty>}
          </div>
        </TabsContent>
        <TabsContent value="saisie">
          <div className="grid max-w-lg gap-3">
            <div>
              <Label>Produit</Label>
              <Select
                value={productId}
                onValueChange={(v) => {
                  setProductId(v);
                  setVariantId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({productStock(p)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected && selected.variants.length > 0 && (
              <div>
                <Label>Variante</Label>
                <Select value={variantId} onValueChange={setVariantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optionnel" />
                  </SelectTrigger>
                  <SelectContent>
                    {selected.variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {variantLabel(v)} ({v.stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as StockMovementType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantité</Label>
                <AmountInput value={qty} onValueChange={setQty} />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button onClick={() => void submit()} className="w-fit">
              Enregistrer le mouvement
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
