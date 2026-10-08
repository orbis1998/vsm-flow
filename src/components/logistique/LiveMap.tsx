import { useEffect, useMemo, useRef, useState } from "react";
import { communeLngLat, KINSHASA_CENTER } from "@/lib/geo";
import { formatArrival, formatEta, formatKm, fetchDrivingRoute, type RoadRoute } from "@/lib/mapbox-route";
import { useFleetLive } from "@/hooks/useFleetLive";
import type { Commune } from "@/types";
import type { FleetDriverLive, FleetOrderLive } from "@/lib/fleet-types";

type Mapbox = typeof import("mapbox-gl").default;
type MapInstance = import("mapbox-gl").Map;
type MarkerHandle = {
  remove: () => void;
  setLngLat: (lngLat: [number, number]) => unknown;
  setRotation?: (deg: number) => unknown;
  getElement?: () => HTMLElement;
};

const PALETTE = ["#ff4d63", "#f5c451", "#3ddc97", "#5b8def", "#c084fc", "#fb923c"];

export function LiveMap({ token, communes }: { token: string; communes: Commune[] }) {
  const live = useFleetLive(Boolean(token));
  const drivers = live.data?.drivers ?? [];
  const orders = live.data?.orders ?? [];
  const [focus, setFocus] = useState<string | "all">("all");
  const [routes, setRoutes] = useState<Record<string, RoadRoute>>({});

  const onRun = useMemo(() => {
    const busy = new Set(orders.map((o) => o.driverId).filter(Boolean));
    return drivers.filter((d) => busy.has(d.id) || (d.lastLat != null && d.lastLng != null && fresh(d.lastSeenAt)));
  }, [drivers, orders]);

  const selected = focus === "all" ? undefined : onRun.find((d) => d.id === focus);
  const etaDriver = selected ?? (onRun.length === 1 ? onRun[0] : undefined);
  const etaRoute = etaDriver ? routes[etaDriver.id] : undefined;
  const etaOrder = etaDriver ? orders.find((o) => o.driverId === etaDriver.id) : undefined;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const run = async () => {
      const next: Record<string, RoadRoute> = {};
      for (const driver of onRun) {
        if (driver.lastLng == null || driver.lastLat == null) continue;
        const destOrder = orders.find((o) => o.driverId === driver.id);
        const dest = destOrder ? destOf(destOrder, communes) : undefined;
        if (!dest) continue;
        const route = await fetchDrivingRoute(token, [driver.lastLng, driver.lastLat], dest);
        if (cancelled) return;
        if (route) next[driver.id] = route;
      }
      if (!cancelled) setRoutes(next);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [token, onRun, orders, communes]);

  if (!token) {
    return (
      <div className="fleet-empty">
        Collez un jeton Mapbox public (pk.) dans Paramètres → Entreprise.
      </div>
    );
  }

  return (
    <section className="fleet">
      <div className="fleet__map">
        <p className="fleet-hud">Live · Kinshasa</p>
        <FleetCanvas
          token={token}
          drivers={onRun}
          orders={orders}
          communes={communes}
          routes={routes}
          focusId={selected ? selected.id : undefined}
        />
        {etaDriver && etaRoute ? (
          <aside className="fleet-eta" aria-live="polite">
            <p className="fleet-eta__kicker">{statusLabel(etaOrder?.status)}</p>
            <p className="fleet-eta__time">{formatEta(etaRoute.durationSec)}</p>
            <p className="fleet-eta__clock">arrivée vers {formatArrival(etaRoute.durationSec)}</p>
            <p className="fleet-eta__meta">
              {formatKm(etaRoute.distanceM)}
              {etaOrder ? ` · ${nameOf(communes, etaOrder.communeId)}` : ""}
            </p>
            <p className="fleet-eta__who">
              {etaDriver.fullName}
              {etaOrder ? ` · ${etaOrder.customerName}` : ""}
            </p>
          </aside>
        ) : (
          <aside className="fleet-eta fleet-eta--idle">
            <p className="fleet-eta__kicker">Flotte</p>
            <p className="fleet-eta__time">{onRun.length}</p>
            <p className="fleet-eta__meta">
              {onRun.length === 0 ? "Aucun livreur en piste" : `${orders.length} course${orders.length > 1 ? "s" : ""} active${orders.length > 1 ? "s" : ""}`}
            </p>
          </aside>
        )}
      </div>
      <aside className="fleet-rail">
        <header className="fleet-rail__head">
          <p>Flotte live</p>
          <button type="button" className={focus === "all" ? "is-link is-on" : "is-link"} onClick={() => setFocus("all")}>
            Tous · {onRun.length}
          </button>
        </header>
        <ul>
          {onRun.length === 0 && <li className="fleet-rail__empty">Aucun livreur en course pour le moment.</li>}
          {onRun.map((d) => {
            const mine = orders.filter((o) => o.driverId === d.id);
            const eta = routes[d.id];
            const on = selected?.id === d.id;
            const moving = fresh(d.lastSeenAt);
            return (
              <li key={d.id}>
                <button type="button" className={on ? "is-on" : undefined} onClick={() => setFocus(d.id)}>
                  <span className={`fleet-dot${moving ? " is-live" : ""}`} style={{ background: colorOf(d.id) }} />
                  <span className="min-w-0 flex-1 text-left">
                    <strong>{d.fullName}</strong>
                    <em>
                      {mine[0]
                        ? `${statusLabel(mine[0].status)} · ${mine[0].customerName} · ${nameOf(communes, mine[0].communeId)}`
                        : moving
                          ? "Position reçue"
                          : "En attente GPS"}
                    </em>
                  </span>
                  <span className="fleet-rail__eta" style={{ color: colorOf(d.id) }}>
                    {eta ? formatEta(eta.durationSec) : "—"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </section>
  );
}

function FleetCanvas({
  token,
  drivers,
  orders,
  communes,
  routes,
  focusId,
}: {
  token: string;
  drivers: FleetDriverLive[];
  orders: FleetOrderLive[];
  communes: Commune[];
  routes: Record<string, RoadRoute>;
  focusId?: string | undefined;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const glRef = useRef<Mapbox | null>(null);
  const markers = useRef<Map<string, MarkerHandle>>(new Map());
  const lastPos = useRef<Map<string, [number, number]>>(new Map());
  const dataRef = useRef({ drivers, orders, communes, routes, focusId });
  dataRef.current = { drivers, orders, communes, routes, focusId };
  const viewRef = useRef("");
  const followRef = useRef<{ id: string; lng: number; lat: number } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || !token) return;
    let cancelled = false;
    let map: MapInstance | undefined;
    let ro: ResizeObserver | undefined;
    const fit = () => {
      map?.resize();
    };

    void (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !host.current) return;
      mapboxgl.accessToken = token;
      glRef.current = mapboxgl;
      map = new mapboxgl.Map({
        container: host.current,
        style: "mapbox://styles/mapbox/navigation-night-v1",
        center: KINSHASA_CENTER,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: true }), "bottom-right");
      mapRef.current = map;
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(fit);
        ro.observe(host.current);
      }
      window.addEventListener("resize", fit);
      map.on("load", () => {
        fit();
        requestAnimationFrame(fit);
        if (!map) return;
        addSources(map);
        paint();
      });
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      window.removeEventListener("resize", fit);
      for (const m of markers.current.values()) m.remove();
      markers.current.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (mapRef.current?.isStyleLoaded()) paint();
  }, [drivers, orders, communes, routes, focusId]);

  function paint() {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl || !map.isStyleLoaded()) return;
    const { drivers: dlist, orders: olist, communes: clist, routes: rmap, focusId: fid } = dataRef.current;
    const next = new Set<string>();
    const bounds = new gl.LngLatBounds();
    let any = false;

    const trailFeatures = dlist
      .filter((d) => d.trail.length > 1)
      .map((d) => lineFeat(
        d.trail.map((p) => [p.lng, p.lat] as [number, number]),
        colorOf(d.id),
        d.id === fid,
      ));
    const routeFeatures = Object.entries(rmap).map(([id, r]) => lineFeat(r.coords, colorOf(id), id === fid));
    setSrc(map, "trails", trailFeatures);
    setSrc(map, "routes", routeFeatures);

    for (const order of olist) {
      const dest = destOf(order, clist);
      if (!dest) continue;
      const key = `o-${order.id}`;
      next.add(key);
      upsert(map, gl, key, dest, "dest", `${order.customerName} · ${nameOf(clist, order.communeId)}`);
      bounds.extend(dest);
      any = true;
    }

    for (const driver of dlist) {
      if (driver.lastLng == null || driver.lastLat == null) continue;
      const lngLat: [number, number] = [driver.lastLng, driver.lastLat];
      const key = `d-${driver.id}`;
      next.add(key);
      const stale = !fresh(driver.lastSeenAt);
      upsert(
        map,
        gl,
        key,
        lngLat,
        stale ? "stale" : "driver",
        driver.fullName,
        driver.lastHeading,
        true,
        colorOf(driver.id),
      );
      bounds.extend(lngLat);
      any = true;
    }

    for (const [key, marker] of markers.current) {
      if (!next.has(key)) {
        marker.remove();
        markers.current.delete(key);
        lastPos.current.delete(key);
      }
    }

    const focus = dlist.find((d) => d.id === fid && d.lastLng != null && d.lastLat != null);
    if (focus?.lastLng != null && focus.lastLat != null) {
      const prev = followRef.current;
      const moved = !prev || prev.id !== focus.id || haversineM(prev.lat, prev.lng, focus.lastLat, focus.lastLng) > 18;
      viewRef.current = `d-${focus.id}`;
      if (moved) {
        followRef.current = { id: focus.id, lng: focus.lastLng, lat: focus.lastLat };
        map.easeTo({
          center: [focus.lastLng, focus.lastLat],
          zoom: Math.max(map.getZoom(), 13.6),
          duration: prev?.id === focus.id ? 1200 : 750,
          pitch: 0,
          essential: true,
        });
      }
    } else if (any) {
      followRef.current = null;
      const key = `all-${dlist.map((d) => d.id).join("|")}-${olist.map((o) => o.id).join("|")}`;
      if (viewRef.current !== key) {
        viewRef.current = key;
        try {
          map.fitBounds(bounds, { padding: 72, maxZoom: 13.2, duration: 800, pitch: 0 });
        } catch {
          // ignore
        }
      }
    }
  }

  function upsert(
    map: MapInstance,
    mapboxgl: Mapbox,
    key: string,
    lngLat: [number, number],
    kind: "driver" | "stale" | "dest",
    title: string,
    heading?: number | undefined,
    smooth?: boolean | undefined,
    color?: string | undefined,
  ) {
    const existing = markers.current.get(key);
    if (existing) {
      const prev = lastPos.current.get(key);
      lastPos.current.set(key, lngLat);
      if (smooth && prev && (prev[0] !== lngLat[0] || prev[1] !== lngLat[1])) {
        glide(existing, prev, lngLat);
      } else {
        existing.setLngLat(lngLat);
      }
      if (heading != null && existing.setRotation) existing.setRotation(heading);
      const el = existing.getElement?.();
      if (el) {
        el.className = `live-pin live-pin--${kind}`;
        if (color) {
          const blade = el.querySelector("b");
          if (blade instanceof HTMLElement) blade.style.background = color;
        }
      }
      return;
    }
    const node = document.createElement("div");
    node.className = `live-pin live-pin--${kind}`;
    node.title = title;
    if (kind === "driver" || kind === "stale") {
      node.innerHTML = `<i></i><b></b>`;
      const blade = node.querySelector("b");
      if (blade instanceof HTMLElement && color) blade.style.background = color;
    }
    const marker = new mapboxgl.Marker({ element: node, anchor: "center", rotationAlignment: "map" })
      .setLngLat(lngLat)
      .addTo(map);
    if (heading != null) marker.setRotation(heading);
    marker.setPopup(new mapboxgl.Popup({ offset: 16, closeButton: false }).setText(title));
    markers.current.set(key, marker);
    lastPos.current.set(key, lngLat);
  }

  return <div ref={host} className="live-map" />;
}

function addSources(map: MapInstance) {
  if (!map.getSource("trails")) {
    map.addSource("trails", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "trails-line",
      type: "line",
      source: "trails",
      paint: {
        "line-color": ["coalesce", ["get", "color"], "#f4f4f0"],
        "line-width": 3,
        "line-opacity": 0.32,
      },
    });
  }
  if (!map.getSource("routes")) {
    map.addSource("routes", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "routes-glow",
      type: "line",
      source: "routes",
      paint: {
        "line-color": ["coalesce", ["get", "color"], "#c41e3a"],
        "line-width": ["case", [">", ["get", "hot"], 0], 10, 7],
        "line-opacity": 0.22,
        "line-blur": 2,
      },
    });
    map.addLayer({
      id: "routes-line",
      type: "line",
      source: "routes",
      paint: {
        "line-color": ["coalesce", ["get", "color"], "#ff4d63"],
        "line-width": ["case", [">", ["get", "hot"], 0], 4.2, 3],
        "line-opacity": 0.95,
      },
    });
  }
}

function lineFeat(coords: [number, number][], color: string, hot: boolean) {
  return {
    type: "Feature" as const,
    properties: { color, hot: hot ? 1 : 0 },
    geometry: { type: "LineString" as const, coordinates: coords },
  };
}

function setSrc(
  map: MapInstance,
  id: string,
  features: Array<{
    type: "Feature";
    properties: object;
    geometry: { type: "LineString"; coordinates: [number, number][] };
  }>,
) {
  const src = map.getSource(id) as import("mapbox-gl").GeoJSONSource | undefined;
  src?.setData({ type: "FeatureCollection", features });
}

function emptyFc() {
  return { type: "FeatureCollection" as const, features: [] as never[] };
}

function glide(marker: MarkerHandle, from: [number, number], to: [number, number]) {
  const t0 = performance.now();
  const ms = 1400;
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms);
    const e = 1 - (1 - p) ** 3;
    marker.setLngLat([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function destOf(order: FleetOrderLive, communes: Commune[]): [number, number] | undefined {
  return communeLngLat(nameOf(communes, order.communeId));
}

function nameOf(communes: Commune[], id: string): string {
  return communes.find((c) => c.id === id)?.name ?? "";
}

function fresh(iso?: string) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 180_000;
}

function colorOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

function statusLabel(status?: string) {
  if (status === "en_livraison") return "En course";
  if (status === "assignee") return "Assigné";
  return "Position live";
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
}
