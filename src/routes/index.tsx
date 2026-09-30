import { createFileRoute } from "@tanstack/react-router";
import { useAppState } from "@/lib/app-store";
import { productStock } from "@/lib/catalog";
import { addDaysYmd, EXPENSE_LABEL, kinshasaYmd, moneyCdf, moneyUsd, num, pct, ymdOf } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { useSession } from "@/hooks/useSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Forbidden, PageHeader, StatCard } from "@/components/common/ui-bits";
import type { ExpenseCategory } from "@/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Tableau de bord — ${APP_NAME}` },
      { name: "description", content: "Gains du jour, comparaison hebdomadaire et dépenses." },
    ],
  }),
  component: Dashboard,
});

function dayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    timeZone: "Africa/Kinshasa",
  });
}

function changePct(now: number, prev: number) {
  if (prev === 0) return now === 0 ? 0 : 100;
  return ((now - prev) / prev) * 100;
}

function Dashboard() {
  const { can, user } = useSession();
  const company = useAppState((s) => s.company);
  const orders = useAppState((s) => s.orders);
  const sales = useAppState((s) => s.sales);
  const products = useAppState((s) => s.products);
  const expenses = useAppState((s) => s.expenses);
  const purchaseOrders = useAppState((s) => s.purchaseOrders);
  if (!can("dashboard.view")) return <Forbidden />;

  const today = kinshasaYmd();
  const weekAgo = addDaysYmd(-7);
  const inDay = (iso: string, ymd: string) => ymdOf(iso) === ymd;
  const merchOn = (ymd: string) =>
    sales.filter((s) => inDay(s.createdAt, ymd)).reduce((n, s) => n + s.total, 0) +
    orders.filter((o) => o.status === "livree" && inDay(o.createdAt, ymd)).reduce((n, o) => n + o.productsTotal, 0);

  const merchToday = merchOn(today);
  const merchWeekAgo = merchOn(weekAgo);
  const delta = changePct(merchToday, merchWeekAgo);

  const weekStart = addDaysYmd(-6);
  const inWeek = (iso: string) => ymdOf(iso) >= weekStart;
  const byCat = (cat: ExpenseCategory, todayOnly = false) =>
    expenses
      .filter((e) => e.category === cat && (todayOnly ? inDay(e.createdAt, today) : inWeek(e.createdAt)))
      .reduce((n, e) => n + e.amount, 0);
  const restockPo = (todayOnly: boolean) =>
    purchaseOrders
      .filter((p) => p.status === "recue" && (todayOnly ? inDay(p.createdAt, today) : inWeek(p.createdAt)))
      .reduce((n, p) => n + p.total, 0);

  const spendRows: Array<[ExpenseCategory | "restock_po", string, number, number]> = [
    ["restock", EXPENSE_LABEL.restock, byCat("restock", true) + restockPo(true), byCat("restock") + restockPo(false)],
    ["salaires", EXPENSE_LABEL.salaires, byCat("salaires", true), byCat("salaires")],
    ["loyer", EXPENSE_LABEL.loyer, byCat("loyer", true), byCat("loyer")],
    ["forfait", EXPENSE_LABEL.forfait, byCat("forfait", true), byCat("forfait")],
    ["divers", EXPENSE_LABEL.divers, byCat("divers", true), byCat("divers")],
    ["transport", EXPENSE_LABEL.transport, byCat("transport", true), byCat("transport")],
    ["marketing", EXPENSE_LABEL.marketing, byCat("marketing", true), byCat("marketing")],
    ["fournitures", EXPENSE_LABEL.fournitures, byCat("fournitures", true), byCat("fournitures")],
  ];
  const spentToday = spendRows.reduce((n, [, , v]) => n + v, 0);
  const spentWeek = spendRows.reduce((n, [, , , v]) => n + v, 0);
  const merchWeek = Array.from({ length: 7 }, (_, i) => merchOn(addDaysYmd(i - 6))).reduce((n, v) => n + v, 0);
  const netWeek = merchWeek - spentWeek;

  const recUsdToday =
    sales.filter((s) => inDay(s.createdAt, today)).reduce((n, s) => n + s.receivedUsd, 0) +
    orders.filter((o) => o.status === "livree" && inDay(o.createdAt, today)).reduce((n, o) => n + o.receivedUsd, 0);
  const recCdfToday =
    sales.filter((s) => inDay(s.createdAt, today)).reduce((n, s) => n + s.receivedCdf, 0) +
    orders.filter((o) => o.status === "livree" && inDay(o.createdAt, today)).reduce((n, o) => n + o.receivedCdf, 0);
  const feesCdfToday = orders
    .filter((o) => o.status === "livree" && inDay(o.createdAt, today))
    .reduce((n, o) => n + o.deliveryFee, 0);

  const chart = Array.from({ length: 7 }, (_, i) => {
    const ymd = addDaysYmd(i - 6);
    return { label: dayLabel(ymd), gains: merchOn(ymd) };
  });

  const low = products.filter((p) => productStock(p) <= p.minStock);
  const pending = orders.filter((o) =>
    ["nouvelle", "a_preparer", "prete", "assignee", "en_livraison"].includes(o.status),
  );
  const rate = company.usdCdfRate || 2800;

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${user.fullName.split(" ")[0] || user.badge}`}
        subtitle={`${company.name || APP_NAME} · activité du ${dayLabel(today)}`}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gains aujourd'hui"
          value={moneyUsd(merchToday)}
          hint={`${moneyCdf(merchToday * rate)} · hors frais livraison`}
          accent
        />
        <StatCard
          label="Il y a 7 jours"
          value={moneyUsd(merchWeekAgo)}
          hint={
            <span className={delta >= 0 ? "text-foreground" : "text-destructive"}>
              {delta >= 0 ? "+" : ""}
              {pct(delta)} vs aujourd'hui
            </span>
          }
        />
        <StatCard label="Dépenses aujourd'hui" value={moneyUsd(spentToday)} hint={`${moneyUsd(spentWeek)} sur 7 jours`} />
        <StatCard
          label="Résultat 7 jours"
          value={moneyUsd(netWeek)}
          hint={`${moneyUsd(merchWeek)} de ventes marchandise`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="rounded-md lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Ventes marchandise (7 jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2">
              {chart.map((d) => {
                const max = Math.max(...chart.map((x) => x.gains), 1);
                const h = Math.max(4, Math.round((d.gains / max) * 100));
                return (
                  <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-32 w-full items-end">
                      <div className="w-full rounded-t-sm bg-primary" style={{ height: `${h}%` }} title={moneyUsd(d.gains)} />
                    </div>
                    <span className="truncate text-[10px] text-muted-foreground">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Encaissé aujourd'hui</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="min-w-0">Reçu en USD</span>
              <span className="num shrink-0 font-semibold">{moneyUsd(recUsdToday)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="min-w-0">Reçu en CDF</span>
              <span className="num shrink-0 font-semibold">{moneyCdf(recCdfToday)}</span>
            </div>
            <div className="flex justify-between gap-2 border-t pt-2 text-muted-foreground">
              <span className="min-w-0">Frais livraison (CDF, hors CA)</span>
              <span className="num shrink-0">{moneyCdf(feesCdfToday)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Taux : 1 USD = {num(rate)} CDF</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Dépenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_5rem_5rem] gap-2 text-[11px] uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Poste</span>
              <span className="text-right">Aujourd'hui</span>
              <span className="text-right">7 jours</span>
            </div>
            <div className="space-y-2">
              {spendRows.map(([, label, todayAmt, weekAmt]) => (
                <div key={label} className="grid grid-cols-1 gap-0.5 text-sm sm:grid-cols-[minmax(0,1fr)_5rem_5rem] sm:items-center sm:gap-2">
                  <span className="truncate font-medium sm:font-normal">{label}</span>
                  <span className="num text-muted-foreground sm:text-right sm:text-foreground">
                    <span className="sm:hidden">Auj. </span>
                    {moneyUsd(todayAmt)}
                  </span>
                  <span className="num font-medium sm:w-auto sm:text-right">
                    <span className="sm:hidden">7 j. </span>
                    {moneyUsd(weekAmt)}
                  </span>
                </div>
              ))}
            </div>
            {spentWeek === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Pas encore de dépenses enregistrées.</p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">À surveiller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="min-w-0">Commandes en cours</span>
              <span className="shrink-0 font-semibold">{pending.length}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="min-w-0">Stock bas</span>
              <span className={low.length ? "shrink-0 font-semibold text-primary" : "shrink-0"}>{low.length}</span>
            </div>
            {low.slice(0, 6).map((p) => (
              <div key={p.id} className="flex justify-between gap-2 text-muted-foreground">
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="shrink-0">{productStock(p)}</span>
              </div>
            ))}
            {low.length === 0 && <p className="text-muted-foreground">Stock OK.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
