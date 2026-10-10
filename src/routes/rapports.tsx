import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { useAppState } from "@/lib/app-store";
import { productStock } from "@/lib/catalog";
import { kinshasaYmd, money, moneyCdf, moneyUsd, num } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { useSession } from "@/hooks/useSession";
import { scopedOrders, scopedSales } from "@/lib/boutique";
import { buildPeriodFiche } from "@/lib/period-fiche";
import { downloadPeriodFichePdf } from "@/lib/fiche-pdf";
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

function monthStart(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

function ReportsPage() {
  const { can, role, posteId } = useSession();
  const company = useAppState((s) => s.company);
  const salesAll = useAppState((s) => s.sales);
  const ordersAll = useAppState((s) => s.orders);
  const users = useAppState((s) => s.users);
  const drivers = useAppState((s) => s.drivers);
  const postes = useAppState((s) => s.postes);
  const products = useAppState((s) => s.products);
  const customers = useAppState((s) => s.customers);
  const expenses = useAppState((s) => s.expenses);
  const today = kinshasaYmd();
  const [from, setFrom] = useState(() => monthStart(today));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  if (!can("reports.view")) return <Forbidden />;

  const orders = scopedOrders(ordersAll, users, drivers, role, posteId);
  const sales = scopedSales(salesAll, role, posteId);
  const fiche = useMemo(
    () => buildPeriodFiche({ from, to, sales, orders, products, expenses, drivers, postes }),
    [from, to, sales, orders, products, expenses, drivers, postes],
  );
  const low = products.filter((p) => productStock(p) <= p.minStock);
  const success = fiche.createdCount ? Math.round((fiche.deliveredCount / fiche.createdCount) * 100) : 0;

  const exportPdf = async () => {
    if (busy) return;
    if (!from || !to || from > to) {
      toast.error("Choisissez une période valide.");
      return;
    }
    setBusy(true);
    try {
      await downloadPeriodFichePdf(fiche, company.name || APP_NAME);
      toast.success("Fiche PDF téléchargée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export PDF impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Rapports"
        subtitle="Le CA des commandes suit le jour de livraison, pas le jour de saisie."
        actions={
          <Button onClick={() => void exportPdf()} disabled={busy}>
            <Download className="mr-1 h-4 w-4" />
            {busy ? "Préparation…" : "Télécharger la fiche PDF"}
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="CA période" value={money(fiche.revenue)} hint="Hors frais de livraison" accent />
        <StatCard label="Ventes POS" value={num(fiche.posCount)} hint={moneyUsd(fiche.posAmount)} />
        <StatCard
          label="Livrées (jour du clic)"
          value={num(fiche.deliveredCount)}
          hint={moneyUsd(fiche.deliveredAmount)}
        />
        <StatCard label="Résultat" value={money(fiche.result)} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Livraisons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Saisies sur la période</span>
              <span className="font-semibold">{fiche.createdCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Livrées (date de livraison)</span>
              <span className="font-semibold">{fiche.deliveredCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Échecs / retours</span>
              <span>{fiche.failedCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Taux livré / saisi</span>
              <span>{success} %</span>
            </div>
            <div className="flex justify-between">
              <span>Livraison hors CA</span>
              <span>{moneyCdf(fiche.feesCdf)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Encaissé & stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>USD reçu</span>
              <span className="font-semibold">{moneyUsd(fiche.receivedUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span>CDF reçu</span>
              <span className="font-semibold">{moneyCdf(fiche.receivedCdf)}</span>
            </div>
            <div className="flex justify-between">
              <span>Références sous seuil</span>
              <span className="font-semibold text-primary">{low.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Clients</span>
              <span>{customers.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Produits les plus vendus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {fiche.topProducts.length === 0 && <p className="text-muted-foreground">Aucun article sur cette période.</p>}
            {fiche.topProducts.slice(0, 8).map((r) => (
              <div key={r.key} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="shrink-0 num">
                  {num(r.qty)} · {moneyUsd(r.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Variantes les plus vendues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {fiche.topVariants.length === 0 && <p className="text-muted-foreground">Aucune variante sur cette période.</p>}
            {fiche.topVariants.slice(0, 8).map((r) => (
              <div key={r.key} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="shrink-0 num">
                  {num(r.qty)} · {moneyUsd(r.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
