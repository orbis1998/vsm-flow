import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ScanLine } from "lucide-react";
import { useAppState } from "@/lib/app-store";
import { communeName, zoneName } from "@/lib/geo";
import { moneyCdf, moneyUsd, ORDER_STATUS_LABEL } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { ordersService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Forbidden, OrderStatusBadge, PageHeader } from "@/components/common/ui-bits";

export const Route = createFileRoute("/livreur")({
  head: () => ({
    meta: [
      { title: `Espace livreur — ${APP_NAME}` },
      { name: "description", content: "Commandes assignées, scan et confirmation de livraison." },
    ],
  }),
  component: DriverPage,
});

function DriverPage() {
  const { can, user, posteId } = useSession();
  const drivers = useAppState((s) => s.drivers);
  const orders = useAppState((s) => s.orders);
  const products = useAppState((s) => s.products);
  const postes = useAppState((s) => s.postes);
  const [scan, setScan] = useState("");
  const [proof, setProof] = useState("");
  const [cash, setCash] = useState<Record<string, { usd: number; cdf: number }>>({});
  if (!can("driver.space") && !can("orders.assigned.view")) return <Forbidden />;

  const driver = drivers.find((d) => d.userId === user.id) ?? drivers.find((d) => d.fullName === user.fullName);
  const mine = orders.filter((o) => driver && o.driverId === driver.id && !["livree", "annulee"].includes(o.status));
  const done = orders.filter((o) => driver && o.driverId === driver.id && o.status === "livree");
  const attached = postes.find((p) => p.id === user.posteId);
  const current = postes.find((p) => p.id === posteId);
  const boutique = attached ?? current;

  const confirm = async (id: string, status: "livree" | "echec" | "en_livraison") => {
    if (status === "livree") {
      const rec = cash[id] ?? { usd: 0, cdf: 0 };
      await ordersService.collectPayment(id, rec.usd, rec.cdf);
    }
    await ordersService.updateStatus(id, status, status === "livree" ? `Preuve : ${proof || "remise en main propre"}` : "Mise à jour livreur");
    toast.success(ORDER_STATUS_LABEL[status]);
    setProof("");
  };

  const doScan = () => {
    const code = scan.trim();
    const product = products.find((p) => p.barcode === code || p.sku === code || p.variants.some((v) => v.barcode === code));
    const order = mine.find((o) => o.reference === code || o.items.some((it) => it.productId === product?.id));
    if (order) {
      toast.success(`Commande ${order.reference} reconnue`);
    } else if (product) {
      toast.message(product.name);
    } else {
      toast.error("Code introuvable");
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Espace livreur"
        subtitle={driver ? `${driver.fullName} · ${driver.vehicle}` : user.fullName}
      />
      <div className="mb-4 rounded-md border bg-card px-3 py-2 text-sm">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Boutique / point de vente</div>
        {boutique ? (
          <div className="mt-0.5 min-w-0">
            <div className="truncate font-medium">{boutique.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {boutique.type}
              {boutique.address ? ` · ${boutique.address}` : ""}
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Aucune boutique rattachée. L'admin l'assigne dans Équipe (poste rattaché) après l'avoir créée dans Paramètres.
          </p>
        )}
      </div>
      {!driver && <p className="mb-4 text-sm text-muted-foreground">Aucun profil livreur lié à ce compte — les commandes assignées n'apparaissent pas.</p>}
      <div className="mb-4 flex gap-2">
        <Input placeholder="Scanner référence ou code-barres…" value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doScan()} />
        <Button variant="outline" onClick={doScan}><ScanLine className="h-4 w-4" /></Button>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{mine.length} en cours · {done.length} livrées</p>
      <div className="space-y-3">
        {mine.map((o) => (
          <Card key={o.id} className="rounded-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-base">
                <span className="min-w-0 truncate">{o.customerName}</span>
                <OrderStatusBadge status={o.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-mono text-xs text-muted-foreground">{o.reference}</div>
              <div>{o.phone}</div>
              <div className="text-muted-foreground">{communeName(o.communeId)}, {zoneName(o.zoneId)} — {o.addressDetail}</div>
              {o.items.map((it) => (
                <div key={it.id} className="flex min-w-0 justify-between gap-2">
                  <span className="min-w-0 truncate">{it.quantity} × {it.productName}</span>
                </div>
              ))}
              <div className="flex justify-between gap-2 font-semibold">
                <span>Marchandise</span>
                <span className="num shrink-0">{moneyUsd(o.productsTotal)}</span>
              </div>
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span>Livraison (hors CA)</span>
                <span className="num shrink-0">{moneyCdf(o.deliveryFee)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Reçu USD</div>
                  <Input
                    type="number"
                    className="h-9"
                    value={cash[o.id]?.usd ?? o.receivedUsd}
                    onChange={(e) => setCash((c) => ({ ...c, [o.id]: { usd: +e.target.value, cdf: c[o.id]?.cdf ?? 0 } }))}
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Reçu CDF</div>
                  <Input
                    type="number"
                    className="h-9"
                    value={cash[o.id]?.cdf ?? o.receivedCdf}
                    onChange={(e) => setCash((c) => ({ ...c, [o.id]: { usd: c[o.id]?.usd ?? 0, cdf: +e.target.value } }))}
                  />
                </div>
              </div>
              <Input placeholder="Signature / preuve simulée" value={proof} onChange={(e) => setProof(e.target.value)} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {o.status !== "en_livraison" && (
                  <Button variant="outline" onClick={() => confirm(o.id, "en_livraison")}>En route</Button>
                )}
                <Button onClick={() => confirm(o.id, "livree")}>Livrée</Button>
                <Button variant="outline" className="text-destructive" onClick={() => confirm(o.id, "echec")}>Échec</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {mine.length === 0 && <p className="text-sm text-muted-foreground">Aucune tournée en cours.</p>}
      </div>
    </div>
  );
}
