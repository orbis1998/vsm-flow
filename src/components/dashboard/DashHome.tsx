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
  compactUsd,
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

function Kpi({
  label,
  value,
  hint,
  series,
  delta,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  series: number[];
  delta?: number;
  accent?: boolean;
}) {
  return (
    <article className={`dash-kpi${accent ? " is-accent" : ""}`}>
      <p className="dash-kpi__label">{label}</p>
      <p className="dash-kpi__value num">
        <AnimatedUsd amount={value} />
      </p>
      <p className="dash-kpi__hint">
        {hint}
        {delta != null && (
          <span className={delta >= 0 ? "is-up" : "is-down"}>
            {delta >= 0 ? " +" : " "}
            {pct(delta)}
          </span>
        )}
      </p>
      <div className="dash-kpi__spark">
        <Sparkline data={series} />
      </div>
    </article>
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

  const orders = scopedOrders(ordersAll, users, drivers, role, posteId);
  const sales = scopedSales(salesAll, role, posteId);
  const boutique = !seesAllBoutiques(role) && posteId ? postes.find((p) => p.id === posteId) : undefined;
  const global = seesAllBoutiques(role);

  const today = kinshasaYmd();
  const days = useMemo(() => rangeDays(range), [range]);
  const rate = company.usdCdfRate || 2800;

  const seriesVentes = days.map((d) => merchOn(sales, orders, d));
  const seriesSpend = days.map((d) => spentOn(expenses, purchaseOrders, d));
  const trend = days.map((d, i) => ({
    label: dayLabel(d),
    ventes: seriesVentes[i] ?? 0,
    depenses: seriesSpend[i] ?? 0,
  }));

  const merchToday = merchOn(sales, orders, today);
  const merchPrev = merchOn(sales, orders, addDaysYmd(-range));
  const merchPeriod = seriesVentes.reduce((n, v) => n + v, 0);
  const spentPeriod = seriesSpend.reduce((n, v) => n + v, 0);
  const spentToday = spentOn(expenses, purchaseOrders, today);
  const netPeriod = merchPeriod - spentPeriod;
  const delta = changePct(merchToday, merchPrev);

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

  return (
    <div className="dash">
      <header className="dash-hero">
        <div className="min-w-0">
          {boutique ? <p className="dash-hero__kicker">{boutique.name}</p> : null}
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

      <section className="dash-kpis">
        <Kpi
          label="Ventes aujourd'hui"
          value={merchToday}
          hint={`${moneyCdf(merchToday * rate)} · hors livraison`}
          series={seriesVentes}
          delta={delta}
          accent
        />
        <Kpi
          label={`Ventes ${range} j`}
          value={merchPeriod}
          hint={`vs ${compactUsd(merchPrev)} il y a ${range} j`}
          series={seriesVentes}
        />
        <Kpi
          label="Dépenses période"
          value={spentPeriod}
          hint={`${moneyUsd(spentToday)} aujourd'hui`}
          series={seriesSpend}
        />
        <Kpi
          label="Résultat période"
          value={netPeriod}
          hint={`${moneyUsd(merchPeriod)} de marchandise`}
          series={seriesVentes.map((v, i) => v - (seriesSpend[i] ?? 0))}
        />
      </section>

      <section className="dash-grid">
        <article className="dash-panel dash-panel--wide">
          <header className="dash-panel__head">
            <h2>Ventes et dépenses</h2>
            <p>Marchandise USD · {range} derniers jours</p>
          </header>
          <TrendChart data={trend} />
        </article>

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
