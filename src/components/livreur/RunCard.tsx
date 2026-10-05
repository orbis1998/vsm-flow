import { useId, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { AmountInput, toNumber } from "@/lib/amount";
import { moneyCdf, moneyUsd, nextOrderStatus, ORDER_PIPELINE, ORDER_STATUS_LABEL, ORDER_STATUS_ORDER, timeKinshasa } from "@/lib/format";
import { communeName, zoneName } from "@/lib/geo";
import { mapsHref, telHref, whatsappHref } from "@/lib/phone";
import { ordersService } from "@/services";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Order, OrderStatus } from "@/types";

const EXCEPTIONS: OrderStatus[] = ["echec", "retour", "annulee"];

export function RunCard({ order }: { order: Order }) {
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [usd, setUsd] = useState("");
  const [cdf, setCdf] = useState("");
  const [proof, setProof] = useState("");
  const [more, setMore] = useState(false);

  const next = nextOrderStatus(order.status);
  const pipeIndex = ORDER_PIPELINE.indexOf(order.status);
  const progress = pipeIndex < 0 ? 0 : (pipeIndex + 1) / ORDER_PIPELINE.length;
  const collecting = next === "livree" || order.status === "en_livraison";
  const place = [communeName(order.communeId), zoneName(order.zoneId), order.addressDetail].filter(Boolean).join(", ");
  const call = telHref(order.phone);
  const wa = whatsappHref(order.phone, `Bonjour ${order.customerName}, je suis le livreur pour ${order.reference}.`);
  const map = mapsHref(place);

  const setStatus = async (status: OrderStatus) => {
    if (busy || status === order.status) return;
    setBusy(true);
    try {
      await ordersService.updateStatus(
        order.id,
        status,
        status === "livree"
          ? `Preuve : ${proof.trim() || "remise en main propre"}`
          : `Livreur · ${ORDER_STATUS_LABEL[status]}`,
        status === "livree" ? { receivedUsd: toNumber(usd), receivedCdf: toNumber(cdf) } : undefined,
      );
      toast.success(ORDER_STATUS_LABEL[status]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className="run-card"
      data-busy={busy || undefined}
      style={{ "--run-progress": String(progress) } as CSSProperties}
    >
      <header className="run-card__head">
        <div className="min-w-0">
          <p className="run-card__ref">{order.reference}</p>
          <h2 className="run-card__name">{order.customerName || "Client"}</h2>
        </div>
        <span className="run-card__badge">{ORDER_STATUS_LABEL[order.status]}</span>
      </header>

      <div className="run-card__actions" role="group" aria-label="Contacter">
        {call ? (
          <a className="run-chip" href={call}>
            Appeler
          </a>
        ) : (
          <span className="run-chip run-chip--mute">{order.phone || "Pas de téléphone"}</span>
        )}
        {wa && (
          <a className="run-chip" href={wa} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        )}
        <a className="run-chip" href={map} target="_blank" rel="noreferrer">
          Itinéraire
        </a>
      </div>

      <p className="run-card__place">{place}</p>
      {order.dueAt && (
        <p className="run-card__place">
          Heure : <strong>{timeKinshasa(order.dueAt)}</strong>
        </p>
      )}
      {order.notes.trim() ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Note</p>
          <p className="mt-0.5 whitespace-pre-wrap">{order.notes}</p>
        </div>
      ) : null}

      <ul className="run-card__items">
        {order.items.map((it) => (
          <li key={it.id}>
            <span>
              {it.quantity} × {it.productName}
            </span>
          </li>
        ))}
      </ul>

      <dl className="run-card__totals">
        <div>
          <dt>Marchandise</dt>
          <dd className="num">{moneyUsd(order.productsTotal)}</dd>
        </div>
        <div>
          <dt>Livraison</dt>
          <dd className="num">{moneyCdf(order.deliveryFee)}</dd>
        </div>
      </dl>

      <div className="run-step" aria-label="Progression">
        <div className="run-step__rail" aria-hidden>
          <div className="run-step__fill" />
        </div>
        <ol className="run-step__dots">
          {ORDER_PIPELINE.map((s, i) => (
            <li
              key={s}
              className={i < pipeIndex ? "is-done" : i === pipeIndex ? "is-now" : undefined}
              title={ORDER_STATUS_LABEL[s]}
            >
              <span className="sr-only">
                {ORDER_STATUS_LABEL[s]}
                {i === pipeIndex ? " — actuel" : ""}
              </span>
            </li>
          ))}
        </ol>
        <p className="run-step__label">
          {pipeIndex >= 0 ? `${pipeIndex + 1} / ${ORDER_PIPELINE.length}` : "Hors parcours"} · {ORDER_STATUS_LABEL[order.status]}
        </p>
      </div>

      {collecting && (
        <div className="run-pay">
          <label>
            Reçu USD
            <AmountInput value={usd} onValueChange={setUsd} placeholder="—" />
          </label>
          <label>
            Reçu CDF
            <AmountInput value={cdf} onValueChange={setCdf} placeholder="—" />
          </label>
          {next === "livree" && (
            <label className="run-pay__full">
              Preuve
              <input value={proof} onChange={(e) => setProof(e.target.value)} placeholder="Signature, photo…" />
            </label>
          )}
        </div>
      )}

      {next && (
        <button type="button" className="run-go" disabled={busy} onClick={() => void setStatus(next)}>
          {busy ? "Enregistrement…" : `Suivant — ${ORDER_STATUS_LABEL[next]}`}
        </button>
      )}

      <div className="run-fail">
        {EXCEPTIONS.map((s) => (
          <button key={s} type="button" disabled={busy || order.status === s} onClick={() => void setStatus(s)}>
            {ORDER_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <details className="run-more" open={more} onToggle={(e) => setMore((e.target as HTMLDetailsElement).open)}>
        <summary>Autre statut</summary>
        <Select value={order.status} onValueChange={(v) => void setStatus(v as OrderStatus)} disabled={busy}>
          <SelectTrigger id={uid} className="mt-2 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </details>
    </article>
  );
}
