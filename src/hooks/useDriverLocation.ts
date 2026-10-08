import { useEffect, useRef } from "react";
import { ordersService } from "@/services";

const INTERVAL_MS = 5_000;
const MIN_MOVE_M = 4;

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Envoie la GPS du livreur tant qu'il a une course assignée ou en livraison. */
export function useDriverLocation(userId: string, tracking: boolean) {
  const last = useRef<{ t: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!tracking || !userId || typeof navigator === "undefined" || !navigator.geolocation) return;

    const send = (lat: number, lng: number, heading?: number | null, accuracy?: number | null) => {
      const now = Date.now();
      const prev = last.current;
      if (prev && now - prev.t < INTERVAL_MS && haversineM(prev.lat, prev.lng, lat, lng) < MIN_MOVE_M) {
        return;
      }
      last.current = { t: now, lat, lng };
      void ordersService.pingLocation({
        userId,
        lat,
        lng,
        ...(heading != null && Number.isFinite(heading) ? { heading } : {}),
        ...(accuracy != null && Number.isFinite(accuracy) ? { accuracy } : {}),
      });
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => send(pos.coords.latitude, pos.coords.longitude, pos.coords.heading, pos.coords.accuracy),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 8_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking, userId]);
}
