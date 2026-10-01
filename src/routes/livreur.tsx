import { createFileRoute } from "@tanstack/react-router";
import { useAppState } from "@/lib/app-store";
import { APP_NAME } from "@/lib/brand";
import { useSession } from "@/hooks/useSession";
import { BoutiqueCard } from "@/components/common/BoutiqueCard";
import { RunCard } from "@/components/livreur/RunCard";
import { Empty, Forbidden, PageHeader } from "@/components/common/ui-bits";

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
  const postes = useAppState((s) => s.postes);
  if (!can("driver.space") && !can("orders.assigned.view")) return <Forbidden />;

  const driver = drivers.find((d) => d.userId === user.id) ?? drivers.find((d) => d.fullName === user.fullName);
  const mine = orders.filter((o) => driver && o.driverId === driver.id && !["livree", "annulee"].includes(o.status));
  const done = orders.filter((o) => driver && o.driverId === driver.id && o.status === "livree");
  const boutique = postes.find((p) => p.id === user.posteId);

  return (
    <div className="mx-auto max-w-lg pb-8">
      <PageHeader
        title="Mes courses"
        subtitle={`${mine.length} en cours · ${done.length} livrées`}
      />
      {boutique ? (
        <BoutiqueCard poste={boutique} className="mb-4" />
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">
          Aucune boutique rattachée. L'admin assigne le livreur à une boutique dans Équipe.
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
    </div>
  );
}
