import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAppState } from "@/mock/store";
import { communeName, zoneName, zonesOfCommune, COMMUNES, ZONES } from "@/mock/geo";
import { money, dateTime, ORDER_STATUS_LABEL, ORDER_STATUS_ORDER } from "@/lib/format";
import { ordersService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, Forbidden, OrderStatusBadge, PageHeader } from "@/components/common/ui-bits";
import type { Order, OrderStatus } from "@/types";

export const Route = createFileRoute("/commandes")({
  head: () => ({
    meta: [
      { title: "Commandes — VSM Business Suite" },
      { name: "description", content: "Saisie, suivi et assignation des commandes de livraison à Kinshasa." },
      { property: "og:title", content: "Commandes — VSM Business Suite" },
      { property: "og:description", content: "Saisie, suivi et assignation des commandes de livraison." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { can } = useSession();
  const orders = useAppState((s) => s.orders);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (status === "all" || o.status === status) &&
          `${o.reference} ${o.customerName} ${o.phone}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [orders, q, status],
  );
  if (!can("orders.view")) return <Forbidden />;
  const current = orders.find((o) => o.id === selected) ?? null;

  return (
    <div>
      <PageHeader
        title="Commandes"
        subtitle={`${orders.length} commandes`}
        actions={
          can("orders.manage") && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nouvelle commande
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Référence, client, téléphone…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {ORDER_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>{ORDER_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <Empty>Aucune commande.</Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Commune</TableHead>
                <TableHead className="text-right">À encaisser</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o.id)}>
                  <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-xs text-muted-foreground">{o.phone}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{communeName(o.communeId)}</TableCell>
                  <TableCell className="num text-right font-semibold">{money(o.totalToCollect)}</TableCell>
                  <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <OrderSheet order={current} onClose={() => setSelected(null)} />
      <NewOrderDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function OrderSheet({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { can } = useSession();
  const drivers = useAppState((s) => s.drivers.filter((d) => d.active));
  return (
    <Sheet open={!!order} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {order && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {order.reference} <OrderStatusBadge status={order.status} />
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="font-semibold">{order.customerName}</div>
                <div>{order.phone}</div>
                <div className="text-muted-foreground">
                  {communeName(order.communeId)}, {zoneName(order.zoneId)} — {order.addressDetail}
                </div>
                {order.landmark && <div className="text-muted-foreground">Repère : {order.landmark}</div>}
              </div>
              <div className="rounded-md border">
                {order.items.map((it) => (
                  <div key={it.id} className="flex justify-between border-b px-3 py-2 last:border-0">
                    <span>{it.quantity} × {it.productName}</span>
                    <span className="num">{money(it.quantity * it.unitPrice - it.discount)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 text-muted-foreground">
                  <span>Livraison</span><span className="num">{money(order.deliveryFee)}</span>
                </div>
                <div className="flex justify-between bg-muted px-3 py-2 font-bold">
                  <span>Total à encaisser</span><span className="num">{money(order.totalToCollect)}</span>
                </div>
              </div>
              {can("orders.manage") && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Statut</Label>
                    <Select
                      value={order.status}
                      onValueChange={async (v) => {
                        await ordersService.updateStatus(order.id, v as OrderStatus);
                        toast.success("Statut mis à jour");
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>{ORDER_STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Livreur</Label>
                    <Select
                      value={order.driverId ?? ""}
                      onValueChange={async (v) => {
                        await ordersService.assignDriver(order.id, v);
                        toast.success("Livreur assigné");
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Assigner…" /></SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div>
                <div className="mb-2 font-semibold">Historique</div>
                <ol className="space-y-2 border-l pl-4">
                  {[...order.history].reverse().map((h) => (
                    <li key={h.id}>
                      <div className="font-medium">{ORDER_STATUS_LABEL[h.status]} — {h.note}</div>
                      <div className="text-xs text-muted-foreground">{h.userName} · {dateTime(h.createdAt)}</div>
                    </li>
                  ))}
                </ol>
              </div>
              {can("orders.manage") && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={async () => {
                    await ordersService.remove(order.id);
                    toast.success("Commande supprimée");
                    onClose();
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Supprimer
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NewOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const customers = useAppState((s) => s.customers);
  const products = useAppState((s) => s.products);
  const [customerId, setCustomerId] = useState("");
  const [communeId, setCommuneId] = useState(COMMUNES[0]!.id);
  const [zoneId, setZoneId] = useState(zonesOfCommune(COMMUNES[0]!.id)[0]!.id);
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Array<{ productId: string; qty: number }>>([]);
  const [productId, setProductId] = useState("");

  const fee = ZONES.find((z) => z.id === zoneId)?.defaultFee ?? 0;
  const total = lines.reduce((s, l) => {
    const p = products.find((x) => x.id === l.productId);
    return s + (p ? (p.promoPrice ?? p.salePrice) * l.qty : 0);
  }, 0);

  const submit = async () => {
    const c = customers.find((x) => x.id === customerId);
    if (!c || lines.length === 0) return toast.error("Choisissez un client et au moins un produit");
    await ordersService.create({
      customerId: c.id,
      customerName: c.fullName,
      phone: c.phone,
      communeId,
      zoneId,
      addressDetail: address || c.address,
      landmark,
      notes,
      deliveryFee: fee,
      items: lines.map((l) => {
        const p = products.find((x) => x.id === l.productId)!;
        return { productId: p.id, variantId: p.variants[0]?.id, productName: p.name, quantity: l.qty, unitPrice: p.promoPrice ?? p.salePrice, discount: 0 };
      }),
    });
    toast.success("Commande créée");
    setLines([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Nouvelle commande</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Client</Label>
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v);
                const c = customers.find((x) => x.id === v);
                if (c) { setCommuneId(c.communeId); setZoneId(c.zoneId); setAddress(c.address); }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Choisir un client" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName} — {c.phone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Commune</Label>
              <Select value={communeId} onValueChange={(v) => { setCommuneId(v); setZoneId(zonesOfCommune(v)[0]!.id); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMMUNES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quartier</Label>
              <Select value={zoneId} onValueChange={setZoneId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{zonesOfCommune(communeId).map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Adresse</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div><Label>Point de repère</Label><Input value={landmark} onChange={(e) => setLandmark(e.target.value)} /></div>
          <div>
            <Label>Produits</Label>
            <div className="flex gap-2">
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Ajouter un produit" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {money(p.promoPrice ?? p.salePrice)}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => productId && setLines((l) => [...l, { productId, qty: 1 }])}>Ajouter</Button>
            </div>
            <div className="mt-2 space-y-1">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{products.find((p) => p.id === l.productId)?.name}</span>
                  <Input type="number" min={1} value={l.qty} className="h-8 w-16" onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: Math.max(1, +e.target.value) } : x)))} />
                  <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="flex justify-between"><span>Produits</span><span className="num">{money(total)}</span></div>
            <div className="flex justify-between"><span>Livraison</span><span className="num">{money(fee)}</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span className="num">{money(total + fee)}</span></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Enregistrer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
