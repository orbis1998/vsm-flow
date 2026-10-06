import { useEffect, useRef } from "react";
import { communeLngLat, KINSHASA_CENTER } from "@/lib/geo";
import type { Commune, DeliveryDriver, Order } from "@/types";

type MarkerHandle = { remove: () => void; setLngLat: (lngLat: [number, number]) => unknown };

type Mapbox = typeof import("mapbox-gl").default;
type MapInstance = import("mapbox-gl").Map;

export function LiveMap({
  token,
  drivers,
  orders,
  communes,
}: {
  token: string;
  drivers: DeliveryDriver[];
  orders: Order[];
  communes: Commune[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const glRef = useRef<Mapbox | null>(null);
  const markers = useRef<Map<string, MarkerHandle>>(new Map());
  const dataRef = useRef({ drivers, orders, communes });
  dataRef.current = { drivers, orders, communes };

  useEffect(() => {
    const el = host.current;
    if (!el || !token) return;
    let cancelled = false;
    let map: MapInstance | undefined;

    void (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      await import("mapbox-gl/dist/mapbox-gl.css");
      if (cancelled || !host.current) return;
      mapboxgl.accessToken = token;
      glRef.current = mapboxgl;
      map = new mapboxgl.Map({
        container: host.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: KINSHASA_CENTER,
        zoom: 11.2,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
      map.on("load", () => {
        if (!map) return;
        if (!map.getSource("runs")) {
          map.addSource("runs", { type: "geojson", data: emptyFc() });
          map.addLayer({
            id: "runs-line",
            type: "line",
            source: "runs",
            paint: {
              "line-color": "#c41e3a",
              "line-width": 2.5,
              "line-opacity": 0.65,
              "line-dasharray": [1.6, 1.2],
            },
          });
        }
        sync(map, mapboxgl);
      });
    })();

    return () => {
      cancelled = true;
      for (const m of markers.current.values()) m.remove();
      markers.current.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl || !map.isStyleLoaded()) return;
    sync(map, gl);
  }, [drivers, orders, communes]);

  function sync(map: MapInstance, mapboxgl: Mapbox) {
    const { drivers: dlist, orders: olist, communes: clist } = dataRef.current;
    const next = new Set<string>();
    const bounds = new mapboxgl.LngLatBounds();
    let any = false;
    const nameOf = (id: string) => clist.find((c) => c.id === id)?.name ?? "";
    const lineFeatures: Array<{
      type: "Feature";
      properties: Record<string, never>;
      geometry: { type: "LineString"; coordinates: [number, number][] };
    }> = [];

    for (const order of olist) {
      const dest = communeLngLat(nameOf(order.communeId));
      if (!dest) continue;
      const key = `o-${order.id}`;
      next.add(key);
      upsert(map, mapboxgl, key, dest, "dest", `${order.customerName} · ${nameOf(order.communeId)}`);
      bounds.extend(dest);
      any = true;
      const driver = dlist.find((d) => d.id === order.driverId);
      if (driver?.lastLng != null && driver.lastLat != null) {
        lineFeatures.push({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [[driver.lastLng, driver.lastLat], dest] },
        });
      }
    }

    for (const driver of dlist) {
      if (driver.lastLng == null || driver.lastLat == null) continue;
      const lngLat: [number, number] = [driver.lastLng, driver.lastLat];
      const key = `d-${driver.id}`;
      next.add(key);
      const stale = driver.lastSeenAt ? Date.now() - new Date(driver.lastSeenAt).getTime() > 180_000 : true;
      upsert(
        map,
        mapboxgl,
        key,
        lngLat,
        stale ? "stale" : "driver",
        `${driver.fullName} · ${ago(driver.lastSeenAt)}`,
      );
      bounds.extend(lngLat);
      any = true;
    }

    for (const [key, marker] of markers.current) {
      if (!next.has(key)) {
        marker.remove();
        markers.current.delete(key);
      }
    }

    const src = map.getSource("runs") as import("mapbox-gl").GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: lineFeatures });

    if (any) {
      try {
        map.fitBounds(bounds, { padding: 72, maxZoom: 14, duration: 700 });
      } catch {
        // ignore
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
  ) {
    const existing = markers.current.get(key);
    if (existing) {
      existing.setLngLat(lngLat);
      return;
    }
    const node = document.createElement("div");
    node.className = `live-pin live-pin--${kind}`;
    node.title = title;
    const marker = new mapboxgl.Marker({ element: node, anchor: "center" }).setLngLat(lngLat).addTo(map);
    marker.setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setText(title));
    markers.current.set(key, marker);
  }

  if (!token) {
    return (
      <div className="flex min-h-[22rem] items-center justify-center rounded-md border bg-muted/40 px-4 text-center text-sm text-muted-foreground">
        Collez un jeton Mapbox public (commence par pk.) dans Paramètres → Entreprise pour afficher Kinshasa.
      </div>
    );
  }

  return <div ref={host} className="live-map h-[min(28rem,70vh)] w-full overflow-hidden rounded-md border" />;
}

function emptyFc() {
  return { type: "FeatureCollection" as const, features: [] as never[] };
}

function ago(iso?: string): string {
  if (!iso) return "jamais vu";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 20) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  return `il y a ${Math.max(1, Math.round(s / 3600))} h`;
}
