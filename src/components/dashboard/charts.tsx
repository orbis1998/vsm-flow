import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId } from "react";
import { moneyUsd } from "@/lib/format";
import { compactUsd } from "@/lib/dashboard";
import { ClientChart, useNarrow } from "./ClientChart";

type VolumeRow = { label: string; current: number; previous: number };

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

function VolumeTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value: number; color: string; name: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const current = payload.find((p) => p.dataKey === "current")?.value ?? 0;
  const previous = payload.find((p) => p.dataKey === "previous")?.value ?? 0;
  const diff = current - previous;
  return (
    <div className="dash-tip dash-tip--pro">
      <p className="dash-tip__label">{label}</p>
      <p>
        <i style={{ background: "var(--dash-red)" }} />
        Période <strong>{moneyUsd(current)}</strong>
      </p>
      <p>
        <i style={{ background: "var(--dash-mute)" }} />
        Précédente <strong>{moneyUsd(previous)}</strong>
      </p>
      <p className="dash-tip__result">
        Écart <strong>{diff >= 0 ? "+" : "−"}{moneyUsd(Math.abs(diff))}</strong>
      </p>
    </div>
  );
}

export function TrendChart({ data }: { data: VolumeRow[] }) {
  const narrow = useNarrow();
  return (
    <div className="dash-trend">
      <ClientChart height={300}>
        <ResponsiveContainer width="100%" height="100%" debounce={40}>
          <AreaChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 2 }}>
            <defs>
              <linearGradient id="dashNow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--dash-red)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--dash-red)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--dash-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--dash-mute)", fontFamily: "IBM Plex Mono, ui-monospace, monospace" }}
              axisLine={false}
              tickLine={false}
              interval={narrow ? "preserveStartEnd" : data.length > 10 ? 2 : data.length > 7 ? 1 : 0}
              minTickGap={narrow ? 28 : 12}
            />
            <YAxis
              tickFormatter={compactUsd}
              tick={{ fontSize: 10, fill: "var(--dash-mute)", fontFamily: "IBM Plex Mono, ui-monospace, monospace" }}
              axisLine={false}
              tickLine={false}
              width={narrow ? 28 : 44}
              hide={narrow}
            />
            <Tooltip
              content={<VolumeTip />}
              allowEscapeViewBox={{ x: false, y: false }}
              wrapperStyle={{ zIndex: 4, maxWidth: "min(16rem, 80vw)" }}
              cursor={{ stroke: "var(--dash-red)", strokeWidth: 1, strokeOpacity: 0.28 }}
            />
            <Line
              type="monotone"
              dataKey="previous"
              name="Période précédente"
              stroke="var(--dash-mute)"
              strokeWidth={1.5}
              strokeDasharray="3 5"
              dot={false}
              animationDuration={900}
            />
            <Area
              type="monotone"
              dataKey="current"
              name="Période"
              stroke="var(--dash-red)"
              strokeWidth={2.4}
              fill="url(#dashNow)"
              activeDot={{ r: 5, strokeWidth: 0, fill: "var(--dash-red)" }}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ClientChart>
      <ul className="dash-trend__keys">
        <li>
          <i className="is-sales" /> Période
        </li>
        <li>
          <i className="is-result" /> Période précédente
        </li>
      </ul>
    </div>
  );
}

export function Sparkline({ data, up }: { data: number[]; up?: boolean }) {
  const gid = useId().replace(/:/g, "");
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <ClientChart height={36}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={up === false ? 0.18 : 0.32} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke="currentColor" strokeWidth={1.8} fill={`url(#${gid})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ClientChart>
  );
}

export function SpendBars({ data }: { data: Array<{ label: string; amount: number }> }) {
  const narrow = useNarrow();
  return (
    <ClientChart height={260}>
      <ResponsiveContainer width="100%" height="100%" debounce={40}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--dash-grid)" horizontal={false} />
          <XAxis type="number" tickFormatter={compactUsd} tick={{ fontSize: 10, fill: "var(--dash-mute)" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={narrow ? 56 : 108}
            tick={{ fontSize: 10, fill: "var(--dash-mute)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<Tip />} allowEscapeViewBox={{ x: false, y: false }} />
          <Bar dataKey="amount" name="Montant" fill="var(--dash-ink)" radius={[0, 6, 6, 0]} barSize={12} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </ClientChart>
  );
}

export function MixDonut({ usd, cdf }: { usd: number; cdf: number }) {
  const narrow = useNarrow();
  const data = [
    { name: "USD", value: usd, color: "var(--dash-red)" },
    { name: "CDF éq.", value: cdf, color: "var(--dash-ink)" },
  ].filter((d) => d.value > 0);
  const empty = data.length === 0;
  return (
    <ClientChart height={220}>
      <ResponsiveContainer width="100%" height="100%" debounce={40}>
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={empty ? [{ name: "—", value: 1, color: "var(--dash-grid)" }] : data}
            dataKey="value"
            nameKey="name"
            innerRadius={narrow ? 44 : 58}
            outerRadius={narrow ? 68 : 82}
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
  const narrow = useNarrow();
  return (
    <ClientChart height={220}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--dash-grid)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--dash-mute)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--dash-mute)" }} axisLine={false} tickLine={false} width={22} hide={narrow} />
          <Tooltip />
          <Bar dataKey="n" name="Commandes" fill="var(--dash-red)" radius={[6, 6, 0, 0]} barSize={18} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </ClientChart>
  );
}

export function BoutiqueChart({ data }: { data: Array<{ name: string; ventes: number; full: string }> }) {
  const narrow = useNarrow();
  return (
    <ClientChart height={240}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--dash-grid)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--dash-mute)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={compactUsd} tick={{ fontSize: 10, fill: "var(--dash-mute)" }} axisLine={false} tickLine={false} width={narrow ? 32 : 40} hide={narrow} />
          <Tooltip content={<Tip />} />
          <Bar dataKey="ventes" name="Caisse" fill="var(--dash-red)" radius={[6, 6, 0, 0]} barSize={26} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </ClientChart>
  );
}
