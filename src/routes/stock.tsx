import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAppState } from "@/mock/store";
import { productStock } from "@/mock/seed";
import { dateTime, money, num } from "@/lib/format";
import { stockService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Forbidden, PageHeader, StatCard } from "@/components/common/ui-bits";
import type { StockMovementType } from "@/types";

export const Route = createFileRoute("/stock")({
  head: () => ({
    meta: [
      { title: "Stock — VSM Business Suite" },
      { name: "description", content: "Niveaux de stock, alertes et mouvements d'entrée et de sortie." },
      { property: "og:title", content: "Stock — VSM Business Suite" },
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

function StockPage() {
  const { can } = useSession();
  const products = useAppState((s) => s.products);
  const movements = useAppState((s) => s.movements);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<StockMovementType>("entree");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  if (!can("stock.view")) return <Forbidden />;

  const value = products.reduce((s, p) => s + productStock(p) * p.purchasePrice, 0);
  const low = products.filter((p) => productStock(p) <= p.minStock);
  const units = products.reduce((s, p) => s + productStock(p), 0);

  const submit = async () => {
    if (!productId || qty <= 0) { toast.error("Produit et quantité requis"); return; }
    const sign = TYPES.find((t) => t[0] === type)![2];
    await stockService.addMovement({ productId, type, quantity: sign * qty, note });
    toast.success("Mouvement enregistré");
    setQty(1);
    setNote("");
  };

  return (
    <div>
      <PageHeader title="Stock" subtitle="Niveaux, alertes et mouvements" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Valeur du stock" value={money(value)} hint="au prix d'achat" accent />
        <StatCard label="Unités en stock" value={num(units)} />
        <StatCard label="Sous le seuil" value={num(low.length)} />
      </div>
      <Tabs defaultValue="niveaux" className="mt-6">
        <TabsList>
          <TabsTrigger value="niveaux">Niveaux</TabsTrigger>
          <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
          {can("stock.manage") && <TabsTrigger value="saisie">Saisir</TabsTrigger>}
        </TabsList>
        <TabsContent value="niveaux">
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Réservé</TableHead><TableHead className="text-right">Seuil</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...products].sort((a, b) => productStock(a) - b.minStock - (productStock(b) - b.minStock)).map((p) => {
                  const st = productStock(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className={`num text-right font-semibold ${st <= p.minStock ? "text-primary" : ""}`}>{st}</TableCell>
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
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Produit</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qté</TableHead></TableRow></TableHeader>
              <TableBody>
                {movements.slice(0, 80).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-xs">{dateTime(m.createdAt)}</TableCell>
                    <TableCell><div>{products.find((p) => p.id === m.productId)?.name ?? "—"}</div><div className="text-xs text-muted-foreground">{m.note}</div></TableCell>
                    <TableCell className="capitalize">{m.type}</TableCell>
                    <TableCell className={`num text-right font-semibold ${m.quantity < 0 ? "text-primary" : ""}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="saisie">
          <div className="grid max-w-lg gap-3">
            <div>
              <Label>Produit</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({productStock(p)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as StockMovementType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Quantité</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(+e.target.value)} /></div>
            </div>
            <div><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <Button onClick={submit} className="w-fit">Enregistrer le mouvement</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
