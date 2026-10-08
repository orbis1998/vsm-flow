import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId } from "react";
import { moneyUsd } from "@/lib/format";
import { compactUsd } from "@/lib/dashboard";
import { ClientChart } from "./ClientChart";

type TrendRow = { label: string; ventes: number; depenses: number };

function Tip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tip">
      <p className="dash-tip__label">{label}</p>
      {payload.map((p) => (
        <p key={p.name}>
          <i style={{ background: p.color }} />
          {p.name} <strong>{moneyUsd(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

function TrendTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const ventes = payload.find((p) => p.dataKey === "ventes")?.value ?? 0;
  const depenses = payload.find((p) => p.dataKey === "depenses")?.value ?? 0;
  const resultat = ventes - depenses;
  return (
    <div className="dash-tip dash-tip--pro">
      <p className="dash-tip__label">{label}</p>
      {payload
        .filter((p) => p.dataKey !== "resultat")
        .map((p) => (
          <p key={p.name}>
            <i style={{ background: p.color }} />
            {p.name} <strong>{moneyUsd(p.value)}</strong>
          </p>
        ))}
      <p className="dash-tip__result">
        Résultat <strong>{moneyUsd(resultat)}</strong>
      </p>
    </div>
  );
}

export function TrendChart({ data }: { data: TrendRow[] }) {
  const rows = data.map((d) => ({ ...d, resultat: d.ventes - d.depenses }));
  const sales = rows.reduce((n, r) => n + r.ventes, 0);
  const spend = rows.reduce((n, r) => n + r.depenses, 0);
  const peak = rows.reduce((best, r) => (r.ventes > best.ventes ? r : best), rows[0] ?? { label: "—", ventes: 0 });
  const last = rows[rows.length - 1];
  return (
    <div className="dash-trend">
      <dl className="dash-trend__strip">
        <div>
          <dt>Ventes</dt>
          <dd className="num">{moneyUsd(sales)}</dd>
        </div>
        <div>
          <dt>Dépenses</dt>
          <dd className="num">{moneyUsd(spend)}</dd>
        </div>
        <div>
          <dt>Résultat</dt>
          <dd className={`num${sales - spend < 0 ? " is-down" : ""}`}>{moneyUsd(sales - spend)}</dd>
        </div>
        <div>
          <dt>Pic</dt>
          <dd className="num">{peak ? `${peak.label} · ${compactUsd(peak.ventes)}` : "—"}</dd>
        </div>
      </dl>
      <ClientChart height={320}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dashVentes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--dash-red)" stopOpacity={0.34} />
                <stop offset="70%" stopColor="var(--dash-red)" stopOpacity={0.06} />
                <stop offset="100%" stopColor="var(--dash-red)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--dash-grid)" vertical={false} strokeDasharray="0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--dash-mute)", fontFamily: "IBM Plex Mono, ui-monospace, monospace" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={compactUsd}
              tick={{ fontSize: 11, fill: "var(--dash-mute)", fontFamily: "IBM Plex Mono, ui-monospace, monospace" }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<TrendTip />} cursor={{ stroke: "var(--dash-red)", strokeWidth: 1, strokeOpacity: 0.35 }} />
            {last && <ReferenceLine x={last.label} stroke="var(--dash-line)" strokeDasharray="3 4" />}
            <Bar dataKey="depenses" name="Dépenses" fill="var(--dash-ink)" fillOpacity={0.12} radius={[3, 3, 0, 0]} barSize={18} />
            <Area
              type="monotone"
              dataKey="ventes"
              name="Ventes"
              stroke="var(--dash-red)"
              strokeWidth={2.6}
              fill="url(#dashVentes)"
              activeDot={{ r: 5, strokeWidth: 0, fill: "var(--dash-red)" }}
              animationDuration={1100}
            />
            <Line
              type="monotone"
              dataKey="resultat"
              name="Résultat"
              stroke="var(--dash-ink)"
              strokeWidth={1.4}
              dot={false}
              strokeDasharray="4 5"
              animationDuration={1100}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ClientChart>
      <ul className="dash-trend__keys">
        <li>
          <i className="is-sales" /> Ventes
        </li>
        <li>
          <i className="is-spend" /> Dépenses
        </li>
        <li>
          <i className="is-result" /> Résultat
        </li>
      </ul>
    </div>
  );
}

export function Sparkline({ data }: { data: number[] }) {
  const gid = useId().replace(/:/g, "");
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <ClientChart height={40}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke="currentColor" strokeWidth={1.6} fill={`url(#${gid})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ClientChart>
  );
}

export function SpendBars({ data }: { data: Array<{ label: string; amount: number }> }) {
  return (
    <ClientChart height={260}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--dash-grid)" horizontal={false} />
          <XAxis type="number" tickFormatter={compactUsd} tick={{ fontSize: 11, fill: "var(--dash-mute)" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={108}
            tick={{ fontSize: 11, fill: "var(--dash-mute)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<Tip />} />
          <Bar dataKey="amount" name="Montant" fill="var(--dash-ink)" radius={[0, 6, 6, 0]} barSize={12} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </ClientChart>
  );
}

export function MixDonut({ usd, cdf }: { usd: number; cdf: number }) {
  const data = [
    { name: "USD", value: usd, color: "var(--dash-red)" },
    { name: "CDF éq.", value: cdf, color: "var(--dash-ink)" },
  ].filter((d) => d.value > 0);
  const empty = data.length === 0;
  return (
    <ClientChart height={220}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={empty ? [{ name: "—", value: 1, color: "var(--dash-grid)" }] : data}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={82}
            paddingAngle={empty ? 0 : 3}
            stroke="none"
          >
            {(empty ? [{ color: "var(--dash-grid)" }] : data).map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          {!empty && <Tooltip formatter={(v) => (typeof v === "number" ? moneyUsd(v) : String(v))} />}
        </PieChart>
      </ResponsiveContainer>
    </ClientChart>
  );
}

export function StatusBars({ data }: { data: Array<{ label: string; n: number }> }) {
  return (
    <ClientChart height={220}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--dash-grid)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--dash-mute)" }} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--dash-mute)" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip />
          <Bar dataKey="n" name="Commandes" fill="var(--dash-red)" radius={[6, 6, 0, 0]} barSize={18} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </ClientChart>
  );
}

export function BoutiqueChart({ data }: { data: Array<{ name: string; ventes: number; full: string }> }) {
  return (
    <ClientChart height={240}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--dash-grid)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--dash-mute)" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={compactUsd} tick={{ fontSize: 11, fill: "var(--dash-mute)" }} axisLine={false} tickLine={false} width={52} />
          <Tooltip content={<Tip />} />
          <Bar dataKey="ventes" name="Caisse" fill="var(--dash-red)" radius={[6, 6, 0, 0]} barSize={26} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </ClientChart>
  );
}
