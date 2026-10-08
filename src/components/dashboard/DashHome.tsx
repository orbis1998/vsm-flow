import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAppState } from "@/lib/app-store";
import { productStock } from "@/lib/catalog";
import { addDaysYmd, kinshasaYmd, moneyCdf, moneyUsd, num, pct, ymdOf, ORDER_STATUS_LABEL } from "@/lib/format";
import { seesAllBoutiques, scopedOrders, scopedSales } from "@/lib/boutique";
import { useSession } from "@/hooks/useSession";
import {
  boutiqueBars,
  byExpenseCat,
  changePct,
  dayLabel,
  merchOn,
  rangeDays,
  spentOn,
  type DashRange,
} from "@/lib/dashboard";
import { BoutiqueChart, MixDonut, Sparkline, SpendBars, StatusBars, TrendChart } from "@/components/dashboard/charts";
import { useCountUp } from "@/components/dashboard/ClientChart";
import type { OrderStatus } from "@/types";

const RANGES: DashRange[] = [7, 14, 30];
const PIPE: OrderStatus[] = ["nouvelle", "a_preparer", "prete", "assignee", "en_livraison"];
type Metric = "today" | "ventes" | "depenses" | "resultat";

function Clock() {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      setText(
        new Date().toLocaleString("fr-FR", {
          timeZone: "Africa/Kinshasa",
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return <span>{text}</span>;
}

function Signal({ delta, invert }: { delta: number; invert?: boolean }) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.05) {
    return <span className="dash-sig is-flat">stable</span>;
  }
  const good = invert ? delta < 0 : delta > 0;
  return (
    <span className={good ? "dash-sig is-up" : "dash-sig is-down"}>
      {delta > 0 ? "▲" : "▼"} {pct(Math.abs(delta))}
    </span>
  );
}

function AnimatedUsd({ amount }: { amount: number }) {
  const n = useCountUp(amount);
  return <>{moneyUsd(n)}</>;
}

export function DashHome() {
  const { role, posteId } = useSession();
  const company = useAppState((s) => s.company);
  const ordersAll = useAppState((s) => s.orders);
  const salesAll = useAppState((s) => s.sales);
  const users = useAppState((s) => s.users);
  const drivers = useAppState((s) => s.drivers);
  const postes = useAppState((s) => s.postes);
  const products = useAppState((s) => s.products);
  const expenses = useAppState((s) => s.expenses);
  const purchaseOrders = useAppState((s) => s.purchaseOrders);
  const [range, setRange] = useState<DashRange>(7);
  const [metric, setMetric] = useState<Metric>("ventes");

  const orders = scopedOrders(ordersAll, users, drivers, role, posteId);
  const sales = scopedSales(salesAll, role, posteId);
  const boutique = !seesAllBoutiques(role) && posteId ? postes.find((p) => p.id === posteId) : undefined;
  const global = seesAllBoutiques(role);

  const today = kinshasaYmd();
  const days = useMemo(() => rangeDays(range), [range]);
  const prevDays = useMemo(() => rangeDays(range, range), [range]);
  const rate = company.usdCdfRate || 2800;

  const seriesVentes = days.map((d) => merchOn(sales, orders, d));
  const seriesSpend = days.map((d) => spentOn(expenses, purchaseOrders, d));
  const seriesNet = seriesVentes.map((v, i) => v - (seriesSpend[i] ?? 0));
  const prevVentes = prevDays.map((d) => merchOn(sales, orders, d));
  const prevSpend = prevDays.map((d) => spentOn(expenses, purchaseOrders, d));
  const prevNet = prevVentes.map((v, i) => v - (prevSpend[i] ?? 0));

  const merchToday = merchOn(sales, orders, today);
  const merchYesterday = merchOn(sales, orders, addDaysYmd(-1));
  const merchPeriod = seriesVentes.reduce((n, v) => n + v, 0);
  const merchPrevPeriod = prevVentes.reduce((n, v) => n + v, 0);
  const spentPeriod = seriesSpend.reduce((n, v) => n + v, 0);
  const spentPrevPeriod = prevSpend.reduce((n, v) => n + v, 0);
  const spentToday = spentOn(expenses, purchaseOrders, today);
  const netPeriod = merchPeriod - spentPeriod;
  const netPrevPeriod = merchPrevPeriod - spentPrevPeriod;

  const dToday = changePct(merchToday, merchYesterday);
  const dVentes = changePct(merchPeriod, merchPrevPeriod);
  const dSpend = changePct(spentPeriod, spentPrevPeriod);
  const dNet = changePct(netPeriod, netPrevPeriod);

  const recUsdToday =
    sales.filter((s) => ymdOf(s.createdAt) === today).reduce((n, s) => n + s.receivedUsd, 0) +
    orders.filter((o) => o.status === "livree" && ymdOf(o.createdAt) === today).reduce((n, o) => n + o.receivedUsd, 0);
  const recCdfToday =
    sales.filter((s) => ymdOf(s.createdAt) === today).reduce((n, s) => n + s.receivedCdf, 0) +
    orders.filter((o) => o.status === "livree" && ymdOf(o.createdAt) === today).reduce((n, o) => n + o.receivedCdf, 0);
  const feesCdfToday = orders
    .filter((o) => o.status === "livree" && ymdOf(o.createdAt) === today)
    .reduce((n, o) => n + o.deliveryFee, 0);

  const cats = byExpenseCat(expenses, purchaseOrders, days);
  const shops = global ? boutiqueBars(postes, sales, days) : [];
  const pending = orders.filter((o) => PIPE.includes(o.status));
  const low = products.filter((p) => productStock(p) <= p.minStock);
  const statusRows = PIPE.map((s) => ({
    label: ORDER_STATUS_LABEL[s].replace("À préparer", "Préparer"),
    n: orders.filter((o) => o.status === s).length,
  }));

  const chartSeries =
    metric === "depenses" ? seriesSpend : metric === "resultat" ? seriesNet : seriesVentes;
  const chartPrev = metric === "depenses" ? prevSpend : metric === "resultat" ? prevNet : prevVentes;
  const chartRows = days.map((d, i) => ({
    label: dayLabel(d),
    current: chartSeries[i] ?? 0,
    previous: chartPrev[i] ?? 0,
  }));

  const tabs: Array<{
    id: Metric;
    label: string;
    value: number;
    delta: number;
    invert?: boolean;
    series: number[];
    hint: string;
  }> = [
    {
      id: "today",
      label: "Aujourd'hui",
      value: merchToday,
      delta: dToday,
      series: seriesVentes,
      hint: "vs hier · hors livraison",
    },
    {
      id: "ventes",
      label: `Ventes ${range} j`,
      value: merchPeriod,
      delta: dVentes,
      series: seriesVentes,
      hint: `vs ${range} j préc.`,
    },
    {
      id: "depenses",
      label: "Dépenses",
      value: spentPeriod,
      delta: dSpend,
      invert: true,
      series: seriesSpend,
      hint: `${moneyUsd(spentToday)} aujourd'hui`,
    },
    {
      id: "resultat",
      label: "Résultat",
      value: netPeriod,
      delta: dNet,
      series: seriesNet,
      hint: `vs ${range} j préc.`,
    },
  ];
  const active = tabs.find((t) => t.id === metric) ?? tabs[1]!;

  return (
    <div className="dash">
      <header className="dash-hero">
        <div className="min-w-0">
          {boutique ? <p className="dash-hero__kicker">{boutique.name}</p> : null}
          <h1 className="dash-hero__title">Tableau de bord</h1>
          <p className="dash-hero__meta">
            <Clock />
            <span aria-hidden>·</span>
            Kinshasa
          </p>
        </div>
        <div className="dash-range" role="tablist" aria-label="Période">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              className={range === r ? "is-on" : undefined}
              onClick={() => setRange(r)}
            >
              {r} j
            </button>
          ))}
        </div>
      </header>

      <section className="dash-board">
        <header className="dash-board__head">
          <div>
            <p className="dash-board__kicker">{active.label}</p>
            <p className="dash-board__value num">
              <AnimatedUsd amount={active.value} />
            </p>
            <p className="dash-board__hint">
              <Signal delta={active.delta} invert={active.invert} />
              <span>{active.hint}</span>
            </p>
          </div>
        </header>
        <div className="dash-board__tabs" role="tablist" aria-label="Indicateur">
          {tabs.map((t) => {
            const on = metric === t.id;
            const sparkUp = t.invert ? t.delta <= 0 : t.delta >= 0;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={on ? "is-on" : undefined}
                onClick={() => setMetric(t.id)}
              >
                <span className="dash-board__tab-top">
                  <span>{t.label}</span>
                  <Signal delta={t.delta} invert={t.invert} />
                </span>
                <span className="dash-board__tab-row">
                  <strong className="num">{moneyUsd(t.value)}</strong>
                  <span className={`dash-board__mini${sparkUp ? "" : " is-down"}`}>
                    <Sparkline data={t.series} up={sparkUp} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <TrendChart data={chartRows} />
      </section>

      <section className="dash-grid">
        <article className="dash-panel">
          <header className="dash-panel__head">
            <h2>Encaissé aujourd'hui</h2>
            <p>Mix des devises reçues</p>
          </header>
          <MixDonut usd={recUsdToday} cdf={recCdfToday / rate} />
          <dl className="dash-legend">
            <div>
              <dt>USD</dt>
              <dd className="num">{moneyUsd(recUsdToday)}</dd>
            </div>
            <div>
              <dt>CDF</dt>
              <dd className="num">{moneyCdf(recCdfToday)}</dd>
            </div>
            <div>
              <dt>Livraison hors CA</dt>
              <dd className="num">{moneyCdf(feesCdfToday)}</dd>
            </div>
          </dl>
          <p className="dash-note">1 USD = {num(rate)} CDF</p>
        </article>

        <article className="dash-panel">
          <header className="dash-panel__head">
            <h2>Dépenses</h2>
            <p>Répartition sur {range} j</p>
          </header>
          {cats.length === 0 ? <p className="dash-empty">Pas encore de dépenses.</p> : <SpendBars data={cats} />}
        </article>

        <article className="dash-panel">
          <header className="dash-panel__head">
            <h2>Pipeline commandes</h2>
            <p>{pending.length} en cours</p>
          </header>
          <StatusBars data={statusRows} />
        </article>

        {global && shops.length > 0 && (
          <article className="dash-panel dash-panel--wide">
            <header className="dash-panel__head">
              <h2>Caisse par boutique</h2>
              <p>Ventes POS · {range} j</p>
            </header>
            <BoutiqueChart data={shops} />
          </article>
        )}

        <article className="dash-panel">
          <header className="dash-panel__head">
            <h2>À surveiller</h2>
            <p>Stock et tournées</p>
          </header>
          <ul className="dash-watch">
            <li>
              <Link to="/commandes">Commandes ouvertes</Link>
              <strong>{pending.length}</strong>
            </li>
            <li>
              <Link to="/stock">Articles en stock bas</Link>
              <strong className={low.length ? "text-primary" : undefined}>{low.length}</strong>
            </li>
          </ul>
          {low.slice(0, 5).map((p) => (
            <div key={p.id} className="dash-watch__row">
              <span>{p.name}</span>
              <span className="num">{productStock(p)}</span>
            </div>
          ))}
          {low.length === 0 && <p className="dash-empty">Stock OK.</p>}
        </article>
      </section>
    </div>
  );
}
