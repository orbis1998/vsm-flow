import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppState } from "@/lib/app-store";
import { communeName, zoneName } from "@/lib/geo";
import { money } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { ordersService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { LiveMap } from "@/components/logistique/LiveMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Forbidden, OrderStatusBadge, PageHeader, StatCard } from "@/components/common/ui-bits";

export const Route = createFileRoute("/logistique")({
  head: () => ({
    meta: [
      { title: `Logistique — ${APP_NAME}` },
      { name: "description", content: "Assignation des livreurs et suivi des tournées dans Kinshasa." },
      { property: "og:title", content: `Logistique — ${APP_NAME}` },
      { property: "og:description", content: "Assignation des livreurs et suivi des tournées." },
    ],
  }),
  component: LogisticsPage,
});

function LogisticsPage() {
  const { can } = useSession();
  const orders = useAppState((s) => s.orders);
  const drivers = useAppState((s) => s.drivers);
  const communes = useAppState((s) => s.communes);
  const mapboxToken = useAppState((s) => s.company.mapboxToken);
  if (!can("logistics.view")) return <Forbidden />;

  const toAssign = orders.filter((o) => ["nouvelle", "a_preparer", "prete"].includes(o.status) && !o.driverId);
  const active = orders.filter((o) => ["assignee", "en_livraison"].includes(o.status));
  const activeDrivers = drivers.filter((d) => d.active);
  const onRun = drivers.filter((d) => active.some((o) => o.driverId === d.id));

  return (
    <div>
      <PageHeader title="Logistique" subtitle="Livreurs et tournées" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="À assigner" value={toAssign.length} accent />
        <StatCard label="En cours" value={active.length} />
        <StatCard label="Livreurs actifs" value={drivers.filter((d) => d.active).length} />
        <StatCard label="À encaisser (en cours)" value={money(active.reduce((s, o) => s + o.totalToCollect, 0))} />
      </div>
      <div className="mt-6">
        <LiveMap token={mapboxToken} drivers={onRun} orders={active} communes={communes} />
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
                  activeDrivers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun livreur actif.</p>
                  ) : (
                    <Select
                      onValueChange={async (v) => {
                        try {
                          await ordersService.assignDriver(o.id, v);
                          toast.success("Livreur assigné");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Assignation impossible");
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-full max-w-44 sm:w-40">
                        <SelectValue placeholder="Assigner…" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeDrivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
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
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{d.fullName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {d.vehicle} · {d.phone}
                        {d.lastSeenAt
                          ? ` · vu ${Math.max(0, Math.round((Date.now() - new Date(d.lastSeenAt).getTime()) / 60000))} min`
                          : mine.length
                            ? " · GPS pas encore reçue"
                            : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {d.canSell && <Badge variant="outline">Vente</Badge>}
                      <Badge className={d.active ? "" : "bg-muted text-muted-foreground"}>{d.active ? "Actif" : "Inactif"}</Badge>
                    </div>
                  </div>
                  {mine.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {mine.map((o) => (
                        <div key={o.id} className="flex min-w-0 items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">{o.customerName} · {communeName(o.communeId)}</span>
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
