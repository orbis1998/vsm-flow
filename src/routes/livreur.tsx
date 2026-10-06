import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppState } from "@/lib/app-store";
import { APP_NAME } from "@/lib/brand";
import { useSession } from "@/hooks/useSession";
import { usePushNotifications } from "@/hooks/usePush";
import { RunCard } from "@/components/livreur/RunCard";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { Empty, Forbidden, PageHeader } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS_LABEL } from "@/lib/format";

export const Route = createFileRoute("/livreur")({
  head: () => ({
    meta: [
      { title: `Espace livreur — ${APP_NAME}` },
      { name: "description", content: "Commandes assignées et confirmation de livraison." },
    ],
  }),
  component: DriverPage,
});

function DriverPage() {
  const { can, user } = useSession();
  const drivers = useAppState((s) => s.drivers);
  const orders = useAppState((s) => s.orders);
  const push = usePushNotifications(user.id);
  const allowed = can("driver.space") || can("orders.assigned.view");
  const driver = drivers.find((d) => d.userId === user.id) ?? drivers.find((d) => d.fullName === user.fullName);
  const mine = orders.filter((o) => driver && o.driverId === driver.id && !["livree", "annulee"].includes(o.status));
  const done = orders.filter((o) => driver && o.driverId === driver.id && o.status === "livree");
  const tracking = allowed && mine.some((o) => o.status === "en_livraison");
  useDriverLocation(user.id, tracking);
  if (!allowed) return <Forbidden />;

  return (
    <div className="mx-auto max-w-lg pb-8">
      <PageHeader
        title="Mes courses"
        subtitle={`${mine.length} en cours · ${done.length} livrées`}
      />
      {!push.enabled && (
        <div className="mb-4 rounded-md border bg-muted/40 p-3">
          <p className="text-sm">
            Activez les notifications pour voir les nouvelles courses sur l'écran verrouillé et dans la barre d'état.
          </p>
          <Button
            className="mt-2"
            size="sm"
            disabled={push.busy}
            onClick={() =>
              void push.enable().catch((error) =>
                toast.error(error instanceof Error ? error.message : "Alertes impossibles"),
              )
            }
          >
            {push.busy ? "Activation…" : "Activer les notifications"}
          </Button>
        </div>
      )}
      {tracking && (
        <p className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Position partagée pendant la course — le bureau vous voit sur la carte.
        </p>
      )}
      {!driver && (
        <p className="mb-4 text-sm text-muted-foreground">
          Aucun profil livreur lié à ce compte — les commandes assignées n'apparaissent pas.
        </p>
      )}
      <div className="flex flex-col gap-4">
        {mine.map((o) => (
          <RunCard key={o.id} order={o} />
        ))}
        {mine.length === 0 && <Empty>Aucune tournée en cours. Les commandes assignées apparaîtront ici.</Empty>}
      </div>
      {done.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">Dernières livraisons</h2>
          <ul className="space-y-2">
            {done.slice(0, 8).map((o) => (
              <li key={o.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="font-medium">{o.customerName}</div>
                <div className="text-xs text-muted-foreground">
                  {o.reference} · {ORDER_STATUS_LABEL[o.status]}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
