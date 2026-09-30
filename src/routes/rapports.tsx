import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppState } from "@/lib/app-store";
import { productStock } from "@/lib/catalog";
import { money, num } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Forbidden, PageHeader, StatCard } from "@/components/common/ui-bits";

export const Route = createFileRoute("/rapports")({
  head: () => ({
    meta: [
      { title: `Rapports — ${APP_NAME}` },
      { name: "description", content: "Rapports ventes, stock, livraisons et finances." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { can } = useSession();
  const sales = useAppState((s) => s.sales);
  const orders = useAppState((s) => s.orders);
  const products = useAppState((s) => s.products);
  const customers = useAppState((s) => s.customers);
  const expenses = useAppState((s) => s.expenses);
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-09-30");
  if (!can("reports.view")) return <Forbidden />;

  const inRange = (iso: string) => iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;
  const salesR = useMemo(() => sales.filter((s) => inRange(s.createdAt)), [sales, from, to]);
  const ordersR = useMemo(() => orders.filter((o) => inRange(o.createdAt)), [orders, from, to]);
  const delivered = ordersR.filter((o) => o.status === "livree");
  const failed = ordersR.filter((o) => o.status === "echec" || o.status === "retour");
  const revenue = salesR.reduce((n, s) => n + s.total, 0) + delivered.reduce((n, o) => n + o.productsTotal, 0);
  const spent = expenses.filter((e) => inRange(e.createdAt)).reduce((n, e) => n + e.amount, 0);
  const low = products.filter((p) => productStock(p) <= p.minStock);

  return (
    <div>
      <PageHeader
        title="Rapports"
        subtitle="Filtres de période — export simulé"
        actions={<Button variant="outline" onClick={() => toast.success("Export CSV simulé")}>Exporter</Button>}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="CA période" value={money(revenue)} accent />
        <StatCard label="Ventes POS" value={num(salesR.length)} />
        <StatCard label="Commandes" value={num(ordersR.length)} hint={`${delivered.length} livrées`} />
        <StatCard label="Résultat" value={money(revenue - spent)} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader><CardTitle className="text-base">Livraisons</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Livrées</span><span className="font-semibold">{delivered.length}</span></div>
            <div className="flex justify-between"><span>Échecs / retours</span><span>{failed.length}</span></div>
            <div className="flex justify-between"><span>Taux de succès</span><span>{ordersR.length ? Math.round((delivered.length / ordersR.length) * 100) : 0} %</span></div>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader><CardTitle className="text-base">Stock & clients</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Références sous seuil</span><span className="font-semibold text-primary">{low.length}</span></div>
            <div className="flex justify-between"><span>Clients</span><span>{customers.length}</span></div>
            <div className="flex justify-between"><span>Clients réguliers</span><span>{customers.filter((c) => c.regular).length}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
