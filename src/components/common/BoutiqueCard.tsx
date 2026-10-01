import { useAppState } from "@/lib/app-store";
import { boutiqueOrders, POSTE_TYPE_LABEL, roleLabel, teamOf } from "@/lib/boutique";
import type { Poste } from "@/types";

export function BoutiqueCard({ poste, className }: { poste: Poste; className?: string }) {
  const users = useAppState((s) => s.users);
  const drivers = useAppState((s) => s.drivers);
  const orders = useAppState((s) => s.orders);
  const team = teamOf(users, poste.id);
  const driverIds = drivers.filter((d) => team.some((u) => u.id === d.userId)).map((d) => d.id);
  const openOrders = boutiqueOrders(orders, poste.id, driverIds).filter(
    (o) => !["livree", "annulee"].includes(o.status),
  );

  return (
    <div className={["space-y-3 rounded-md border bg-card p-3 text-sm", className].filter(Boolean).join(" ")}>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cette boutique</div>
        <div className="truncate font-semibold">{poste.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {POSTE_TYPE_LABEL[poste.type]}
          {poste.address ? ` · ${poste.address}` : ""}
          {` · ${openOrders.length} course${openOrders.length === 1 ? "" : "s"}`}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Équipe rattachée</div>
        {team.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Personne n'est encore rattaché. Dans Équipe, assignez un gérant, un caissier et un livreur à cette boutique.
          </p>
        ) : (
          <ul className="space-y-1">
            {team.map((u) => (
              <li key={u.id} className="flex min-w-0 justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium">{u.fullName}</span>
                <span className="shrink-0 text-muted-foreground">{roleLabel(u.role)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
