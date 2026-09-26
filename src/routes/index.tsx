import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppState } from "@/mock/store";
import { productStock } from "@/mock/seed";
import { communeName } from "@/mock/geo";
import { money, num, dateTime } from "@/lib/format";
import { useSession } from "@/hooks/useSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Forbidden, OrderStatusBadge, PageHeader, StatCard } from "@/components/common/ui-bits";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — VSM Business Suite" },
      { name: "description", content: "Vue d'ensemble des ventes, commandes, livraisons et stock de VSM Collection." },
      { property: "og:title", content: "Tableau de bord — VSM Business Suite" },
      { property: "og:description", content: "Vue d'ensemble des ventes, commandes, livraisons et stock." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { can, user } = useSession();
  const orders = useAppState((s) => s.orders);
  const sales = useAppState((s) => s.sales);
  const products = useAppState((s) => s.products);
  const expenses = useAppState((s) => s.expenses);
  if (!can("dashboard.view")) return <Forbidden />;

  const delivered = orders.filter((o) => o.status === "livree");
  const revenue = sales.reduce((s, x) => s + x.total, 0) + delivered.reduce((s, o) => s + o.productsTotal, 0);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const pending = orders.filter((o) => ["nouvelle", "a_preparer", "prete", "assignee", "en_livraison"].includes(o.status));
  const low = products.filter((p) => productStock(p) <= p.minStock);

  const byCommune = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      const n = communeName(o.communeId);
      acc[n] = (acc[n] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div>
      <PageHeader title={`Bonjour, ${user.fullName.split(" ")[0]}`} subtitle="Activité de VSM Collection" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Chiffre d'affaires" value={money(revenue)} hint="Ventes POS + livraisons" accent />
        <StatCard label="Dépenses" value={money(spent)} />
        <StatCard label="Commandes en cours" value={num(pending.length)} hint={`${delivered.length} livrées`} />
        <StatCard label="Stock bas" value={num(low.length)} hint="produits sous le seuil" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-md lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Commandes par commune</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCommune}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} fontSize={11} width={28} />
                <Tooltip />
                <Bar dataKey="count" name="Commandes" fill="var(--primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Alertes stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {low.slice(0, 7).map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="truncate pr-2">{p.name}</span>
                <span className="num font-semibold text-primary">{productStock(p)}</span>
              </div>
            ))}
            {low.length === 0 && <p className="text-sm text-muted-foreground">Aucune alerte.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 rounded-md">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Dernières commandes</CardTitle>
          <Link to="/commandes" className="text-sm text-primary">Tout voir</Link>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {orders.slice(0, 6).map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
              <div>
                <div className="font-medium">{o.customerName}</div>
                <div className="text-xs text-muted-foreground">
                  {o.reference} · {communeName(o.communeId)} · {dateTime(o.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="num font-semibold">{money(o.totalToCollect)}</span>
                <OrderStatusBadge status={o.status} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
