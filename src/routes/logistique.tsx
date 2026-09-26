import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppState } from "@/mock/store";
import { communeName, zoneName } from "@/mock/geo";
import { money } from "@/lib/format";
import { ordersService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Forbidden, OrderStatusBadge, PageHeader, StatCard } from "@/components/common/ui-bits";

export const Route = createFileRoute("/logistique")({
  head: () => ({
    meta: [
      { title: "Logistique — VSM Business Suite" },
      { name: "description", content: "Assignation des livreurs et suivi des tournées dans Kinshasa." },
      { property: "og:title", content: "Logistique — VSM Business Suite" },
      { property: "og:description", content: "Assignation des livreurs et suivi des tournées." },
    ],
  }),
  component: LogisticsPage,
});

function LogisticsPage() {
  const { can } = useSession();
  const orders = useAppState((s) => s.orders);
  const drivers = useAppState((s) => s.drivers);
  if (!can("logistics.view")) return <Forbidden />;

  const toAssign = orders.filter((o) => ["nouvelle", "a_preparer", "prete"].includes(o.status) && !o.driverId);
  const active = orders.filter((o) => ["assignee", "en_livraison"].includes(o.status));

  return (
    <div>
      <PageHeader title="Logistique" subtitle="Livreurs et tournées" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="À assigner" value={toAssign.length} accent />
        <StatCard label="En cours" value={active.length} />
        <StatCard label="Livreurs actifs" value={drivers.filter((d) => d.active).length} />
        <StatCard label="À encaisser (en cours)" value={money(active.reduce((s, o) => s + o.totalToCollect, 0))} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader><CardTitle className="text-base">Commandes à assigner</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {toAssign.length === 0 && <p className="px-6 pb-4 text-sm text-muted-foreground">Tout est assigné.</p>}
            {toAssign.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-2 px-6 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{o.customerName} <span className="font-mono text-xs text-muted-foreground">{o.reference}</span></div>
                  <div className="text-xs text-muted-foreground">{communeName(o.communeId)}, {zoneName(o.zoneId)}</div>
                </div>
                {can("logistics.manage") && (
                  <Select onValueChange={async (v) => { await ordersService.assignDriver(o.id, v); toast.success("Livreur assigné"); }}>
                    <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Assigner…" /></SelectTrigger>
                    <SelectContent>{drivers.filter((d) => d.active).map((d) => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-3">
          {drivers.map((d) => {
            const mine = active.filter((o) => o.driverId === d.id);
            return (
              <Card key={d.id} className="rounded-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{d.fullName}</div>
                      <div className="text-xs text-muted-foreground">{d.vehicle} · {d.phone}</div>
                    </div>
                    <div className="flex gap-1">
                      {d.canSell && <Badge variant="outline">Vente</Badge>}
                      <Badge className={d.active ? "" : "bg-muted text-muted-foreground"}>{d.active ? "Actif" : "Inactif"}</Badge>
                    </div>
                  </div>
                  {mine.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {mine.map((o) => (
                        <div key={o.id} className="flex items-center justify-between text-sm">
                          <span className="truncate">{o.customerName} · {communeName(o.communeId)}</span>
                          <OrderStatusBadge status={o.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
