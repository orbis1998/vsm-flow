export type RoadRoute = {
  coords: [number, number][];
  durationSec: number;
  distanceM: number;
};

const cache = new Map<string, { at: number; route: RoadRoute }>();
const TTL = 25_000;

export function formatEta(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatArrival(sec: number): string {
  const at = new Date(Date.now() + Math.max(0, sec) * 1000);
  return new Intl.DateTimeFormat("fr-CD", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kinshasa",
  }).format(at);
}

export async function fetchDrivingRoute(
  token: string,
  from: [number, number],
  to: [number, number],
): Promise<RoadRoute | null> {
  const key = `${from[0].toFixed(4)},${from[1].toFixed(4)}>${to[0].toFixed(4)},${to[1].toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.route;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}` +
    `?geometries=geojson&overview=full&alternatives=false&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      routes?: Array<{ duration: number; distance: number; geometry?: { coordinates?: [number, number][] } }>;
    };
    const route = json.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!route || !coords?.length) return null;
    const next = { coords, durationSec: route.duration, distanceM: route.distance };
    cache.set(key, { at: Date.now(), route: next });
    return next;
  } catch {
    return null;
  }
}
