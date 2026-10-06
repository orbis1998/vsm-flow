import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAppState } from "@/lib/app-store";
import { communeName, zoneName } from "@/lib/geo";
import { driverProductQty, driverVariantQty, pickAvailableVariant, productStock } from "@/lib/catalog";
import { dateTime, dueAtFromKinshasaTime, moneyCdf, moneyUsd, ORDER_STATUS_LABEL, ORDER_STATUS_ORDER, timeKinshasa } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { variantLabel } from "@/lib/variants";
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
import { AmountInput, toNumber } from "@/lib/amount";
import { scopedOrders } from "@/lib/boutique";
import type { Order, OrderItem, OrderStatus } from "@/types";

export const Route = createFileRoute("/commandes")({
  head: () => ({
    meta: [
      { title: `Commandes — ${APP_NAME}` },
      { name: "description", content: "Saisie, suivi et assignation des commandes de livraison à Kinshasa." },
      { property: "og:title", content: `Commandes — ${APP_NAME}` },
      { property: "og:description", content: "Saisie, suivi et assignation des commandes de livraison." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { can, role, posteId } = useSession();
  const ordersAll = useAppState((s) => s.orders);
  const users = useAppState((s) => s.users);
  const drivers = useAppState((s) => s.drivers);
  const orders = scopedOrders(ordersAll, users, drivers, role, posteId);
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
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Commune</TableHead>
                <TableHead className="text-right">Marchandise</TableHead>
                <TableHead className="hidden text-right md:table-cell">Livraison CDF</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Livreur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o.id)}>
                  <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.customerName || "Client"}</div>
                    <div className="text-xs text-muted-foreground">{o.phone}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{communeName(o.communeId)}</TableCell>
                  <TableCell className="num text-right font-semibold">{moneyUsd(o.productsTotal)}</TableCell>
                  <TableCell className="num hidden text-right md:table-cell">{moneyCdf(o.deliveryFee)}</TableCell>
                  <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                  <TableCell className="hidden max-w-[8rem] truncate text-xs lg:table-cell">
                    {drivers.find((d) => d.id === o.driverId)?.fullName ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <OrderSheet order={current} onClose={() => setSelected(null)} />
      <NewOrderDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          setCreating(false);
          setSelected(id);
        }}
      />
    </div>
  );
}

function OrderSheet({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { can } = useSession();
  const allDrivers = useAppState((s) => s.drivers);
  const products = useAppState((s) => s.products);
  const [receivedUsd, setReceivedUsd] = useState("");
  const [receivedCdf, setReceivedCdf] = useState("");
  const [draft, setDraft] = useState<OrderItem[]>([]);
  const drivers = allDrivers.filter((d) => d.active || d.id === order?.driverId);
  const driverValue =
    order?.driverId && drivers.some((d) => d.id === order.driverId) ? order.driverId : undefined;

  useEffect(() => {
    setReceivedUsd(order?.receivedUsd ? String(order.receivedUsd) : "");
    setReceivedCdf(order?.receivedCdf ? String(order.receivedCdf) : "");
    setDraft(order?.items ?? []);
  }, [order?.id, order?.receivedUsd, order?.receivedCdf, order?.items]);

  return (
    <Sheet open={!!order} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {order && (
          <>
            <SheetHeader>
              <SheetTitle className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate">{order.reference}</span>
                <OrderStatusBadge status={order.status} />
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="font-semibold">{order.customerName || "Client"}</div>
                <div>{order.phone}</div>
                <div className="text-muted-foreground">
                  {communeName(order.communeId)}, {zoneName(order.zoneId)} — {order.addressDetail}
                </div>
                {order.dueAt && (
                  <div className="mt-1 font-medium">Heure : {timeKinshasa(order.dueAt)}</div>
                )}
                {order.notes ? <div className="mt-2 rounded-md bg-muted p-2">{order.notes}</div> : null}
                {order.landmark && <div className="text-muted-foreground">Repère : {order.landmark}</div>}
              </div>
              <div className="rounded-md border">
                {draft.map((it, idx) => {
                  const product = products.find((p) => p.id === it.productId);
                  return (
                    <div key={it.id || idx} className="border-b px-3 py-2 last:border-0">
                      <div className="flex justify-between gap-2">
                        <span className="min-w-0 truncate">{it.quantity} × {it.productName}</span>
                        <span className="num shrink-0">{moneyUsd(it.quantity * it.unitPrice - it.discount)}</span>
                      </div>
                      {can("orders.manage") && product && product.variants.length > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <Select
                            value={
                              it.variantId && product.variants.some((v) => v.id === it.variantId)
                                ? it.variantId
                                : product.variants[0]?.id
                            }
                            onValueChange={(v) => {
                              const variant = product.variants.find((x) => x.id === v);
                              const name = variant ? `${product.name} (${variantLabel(variant.options)})` : product.name;
                              setDraft((rows) => rows.map((r, i) => (i === idx ? { ...r, variantId: v, productName: name } : r)));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {product.variants.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {variantLabel(v.options)} · stock {v.stock}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <AmountInput
                            className="h-8 w-16"
                            value={it.quantity ? String(it.quantity) : ""}
                            onValueChange={(raw) =>
                              setDraft((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, quantity: Math.max(0, Math.round(toNumber(raw))) } : r)),
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex justify-between px-3 py-2 font-semibold">
                  <span>Marchandise</span><span className="num">{moneyUsd(order.productsTotal)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 text-muted-foreground">
                  <span>Livraison (CDF, hors CA)</span><span className="num">{moneyCdf(order.deliveryFee)}</span>
                </div>
              </div>
              {can("orders.manage") && (
                <p className="text-xs text-muted-foreground">
                  Si le client prend une autre taille (XL → XXL), changez la variante puis enregistrez : le stock bascule.
                </p>
              )}
              {can("orders.manage") && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await ordersService.replaceItems(
                      order.id,
                      draft.map(({ id: _id, ...rest }) => rest),
                    );
                    toast.success("Articles et stock mis à jour");
                  }}
                >
                  Enregistrer la correction
                </Button>
              )}
              {(can("orders.manage") || can("driver.space")) && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Reçu USD</Label>
                    <AmountInput value={receivedUsd} onValueChange={setReceivedUsd} placeholder="—" />
                  </div>
                  <div>
                    <Label>Reçu CDF</Label>
                    <AmountInput value={receivedCdf} onValueChange={setReceivedCdf} placeholder="—" />
                  </div>
                  <Button
                    className="col-span-2"
                    variant="outline"
                    onClick={async () => {
                      await ordersService.collectPayment(order.id, toNumber(receivedUsd), toNumber(receivedCdf));
                      toast.success("Encaissement enregistré");
                    }}
                  >
                    Enregistrer l'encaissement
                  </Button>
                </div>
              )}
              {can("orders.manage") && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Statut</Label>
                    <Select
                      value={order.status}
                      onValueChange={async (v) => {
                        try {
                          await ordersService.updateStatus(order.id, v as OrderStatus);
                          toast.success("Statut mis à jour");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
                        }
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
                  <div className="min-w-0">
                    <Label>Livreur (son stock d'abord, sinon la boutique)</Label>
                    {drivers.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Aucun livreur. Créez un compte rôle Livreur dans Équipe.
                      </p>
                    ) : (
                      <Select
                        value={driverValue}
                        onValueChange={async (v) => {
                          try {
                            await ordersService.assignDriver(order.id, v);
                            toast.success("Livreur assigné");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Assignation impossible");
                          }
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Assigner un livreur…" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {order.driverId && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {drivers.find((d) => d.id === order.driverId)?.fullName ?? "Assigné"}
                      </p>
                    )}
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

function NewOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { role, posteId } = useSession();
  const customers = useAppState((s) => s.customers);
  const products = useAppState((s) => s.products);
  const communes = useAppState((s) => s.communes);
  const zones = useAppState((s) => s.zones);
  const drivers = useAppState((s) => s.drivers.filter((d) => d.active));
  const driverStock = useAppState((s) => s.driverStock ?? []);
  const zonesOf = (cid: string) => zones.filter((z) => z.communeId === cid);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [communeId, setCommuneId] = useState(communes[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(zonesOf(communes[0]?.id ?? "")[0]?.id ?? "");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [notes, setNotes] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [lines, setLines] = useState<Array<{ productId: string; variantId: string; qty: number }>>([]);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [saving, setSaving] = useState(false);
  const [variantKey, setVariantKey] = useState(0);

  const productQty = (p: { id: string; variants: Array<{ id: string; stock: number }> }) => {
    const boutique = productStock(p as never);
    if (!driverId) return boutique;
    return Math.max(driverProductQty(driverStock, driverId, p.id), boutique);
  };
  const available = products.filter((p) => productQty(p) > 0);
  const selectedProduct = products.find((p) => p.id === productId);
  const stockVariants = selectedProduct?.variants ?? [];
  const fee = zones.find((z) => z.id === zoneId)?.defaultFee ?? 0;
  const total = lines.reduce((s, l) => {
    const p = products.find((x) => x.id === l.productId);
    return s + (p ? (p.promoPrice ?? p.salePrice) * l.qty : 0);
  }, 0);

  const addLine = () => {
    if (!productId) return;
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const chosen = variantId || pickAvailableVariant(p)?.id || p.variants[0]?.id;
    const variant = p.variants.find((v) => v.id === chosen);
    if (!variant) {
      toast.error("Choisissez une variante");
      return;
    }
    const driverHave = driverId
      ? Math.max(
          driverVariantQty(driverStock, driverId, p.id, variant.id),
          driverProductQty(driverStock, driverId, p.id),
        )
      : 0;
    const boutiqueHave = variant.stock;
    if (driverHave < 1 && boutiqueHave < 1) {
      toast.error(`${p.name} : rupture de stock (livreur et boutique)`);
      return;
    }
    setLines((l) => [...l, { productId, variantId: variant.id, qty: 0 }]);
    const used = new Set(
      [...lines, { productId, variantId: variant.id }]
        .filter((l) => l.productId === productId)
        .map((l) => l.variantId),
    );
    const nextVariant = p.variants.find((v) => !used.has(v.id));
    setVariantId(nextVariant?.id ?? variant.id);
    setVariantKey((n) => n + 1);
  };

  const submit = async () => {
    if (saving) return;
    if (lines.length === 0) {
      toast.error("Ajoutez au moins un produit en stock");
      return;
    }
    if (!communeId || !zoneId) {
      toast.error("Choisissez une commune et un quartier");
      return;
    }
    const items = [];
    for (const l of lines) {
      const p = products.find((x) => x.id === l.productId);
      if (!p) continue;
      const variant =
        p.variants.find((v) => v.id === l.variantId) ??
        (driverId
          ? p.variants.find((v) => driverVariantQty(driverStock, driverId, p.id, v.id) >= l.qty)
          : pickAvailableVariant(p, l.qty));
      const driverHave = variant && driverId ? driverVariantQty(driverStock, driverId, p.id, variant.id) : 0;
      const boutiqueHave = variant ? variant.stock : 0;
      if (!l.qty || l.qty < 1) {
        toast.error(`${p.name} : indiquez la quantité`);
        return;
      }
      if (!variant || driverHave + boutiqueHave < l.qty) {
        toast.error(`${p.name} : stock insuffisant`);
        return;
      }
      const label = variantLabel(variant.options);
      items.push({
        productId: p.id,
        variantId: variant.id,
        productName: label && label !== "Standard" ? `${p.name} (${label})` : p.name,
        quantity: Math.round(l.qty),
        unitPrice: p.promoPrice ?? p.salePrice,
        discount: 0,
      });
    }
    if (items.length === 0) {
      toast.error("Ajoutez au moins un produit en stock");
      return;
    }
    setSaving(true);
    try {
      const order = await ordersService.create({
        ...(customerId ? { customerId } : {}),
        customerName: customerName.trim(),
        phone,
        communeId,
        zoneId,
        addressDetail: address,
        landmark,
        notes,
        deliveryFee: fee,
        items,
        ...(driverId ? { driverId } : {}),
        ...(role !== "ADMIN" && posteId ? { posteId } : {}),
        ...(dueAtFromKinshasaTime(dueTime) ? { dueAt: dueAtFromKinshasaTime(dueTime) } : {}),
      });
      toast.success(driverId ? "Commande créée et assignée" : "Commande créée");
      setLines([]);
      setCustomerId("");
      setCustomerName("");
      setPhone("");
      setDriverId("");
      setNotes("");
      setDueTime("");
      onOpenChange(false);
      if (order?.id) onCreated(order.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Nouvelle commande</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Client existant (facultatif)</Label>
            <Select
              value={customerId || "__none"}
              onValueChange={(v) => {
                if (v === "__none") {
                  setCustomerId("");
                  return;
                }
                setCustomerId(v);
                const c = customers.find((x) => x.id === v);
                if (c) {
                  setCustomerName(c.fullName);
                  setPhone(c.phone);
                  setCommuneId(c.communeId);
                  setZoneId(c.zoneId);
                  setAddress(c.address);
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Aucun — saisie libre</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName} — {c.phone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Nom du client (facultatif)</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Laissé vide = Client" />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Commune</Label>
              <Select value={communeId || undefined} onValueChange={(v) => { setCommuneId(v); setZoneId(zonesOf(v)[0]?.id ?? ""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{communes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quartier</Label>
              <Select value={zoneId || undefined} onValueChange={setZoneId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{zonesOf(communeId).map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Adresse</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div><Label>Point de repère</Label><Input value={landmark} onChange={(e) => setLandmark(e.target.value)} /></div>
          <div>
            <Label>Articles et variantes</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Select
                value={productId || undefined}
                onValueChange={(v) => {
                  setProductId(v);
                  const p = products.find((x) => x.id === v);
                  setVariantId(p?.variants[0]?.id ?? "");
                  setVariantKey((n) => n + 1);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Produit" /></SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      Aucun article en stock
                    </SelectItem>
                  ) : (
                    available.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {productQty(p)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Select
                key={variantKey}
                value={variantId || undefined}
                onValueChange={setVariantId}
                disabled={!productId}
              >
                <SelectTrigger><SelectValue placeholder="Variante / taille" /></SelectTrigger>
                <SelectContent>
                  {stockVariants.map((v) => {
                    const dQty = driverId ? driverVariantQty(driverStock, driverId, selectedProduct!.id, v.id) : 0;
                    const shown = driverId ? `${dQty} livreur · ${v.stock} boutique` : String(v.stock);
                    return (
                      <SelectItem key={v.id} value={v.id}>
                        {variantLabel(v.options)} · {shown}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addLine}>Ajouter</Button>
            </div>
            <div className="mt-2 space-y-1">
              {lines.map((l, i) => {
                const p = products.find((x) => x.id === l.productId);
                const v = p?.variants.find((x) => x.id === l.variantId);
                return (
                  <div key={i} className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {p?.name}
                      {v ? ` · ${variantLabel(v.options)}` : ""}
                    </span>
                    <AmountInput className="h-8 w-16 shrink-0" value={l.qty ? String(l.qty) : ""} onValueChange={(raw) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: Math.max(0, Math.round(toNumber(raw))) } : x)))} />
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Livreur (facultatif — son stock d'abord, sinon la boutique)</Label>
            {drivers.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Aucun livreur. Créez un compte rôle Livreur dans Équipe.</p>
            ) : (
              <Select
                value={driverId || undefined}
                onValueChange={(v) => {
                  setDriverId(v);
                  setVariantKey((n) => n + 1);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Assigner plus tard" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Heure de livraison</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
            <div>
              <Label>Notes pour le livreur</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Appeler avant d'arriver…" />
            </div>
          </div>
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="flex justify-between gap-2"><span>Marchandise</span><span className="num shrink-0">{moneyUsd(total)}</span></div>
            <div className="flex justify-between gap-2"><span>Livraison (CDF, hors CA)</span><span className="num shrink-0">{moneyCdf(fee)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
