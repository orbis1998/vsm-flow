import { useEffect } from "react";
import { getVapidPublicFn, savePushSubscriptionFn } from "@/fn/push";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function usePushNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;
    const run = async () => {
      try {
        const permission = Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
        if (permission !== "granted" || cancelled) return;
        const publicKey = await getVapidPublicFn();
        if (!publicKey || cancelled) return;
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }
        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
        await savePushSubscriptionFn({
          data: {
            userId,
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
        });
      } catch {
        // permission denied or insecure origin
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
