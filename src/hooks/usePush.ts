import { useEffect, useState } from "react";
import { getVapidPublicFn, savePushSubscriptionFn } from "@/fn/push";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function subscribePush(userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Ce navigateur ne prend pas en charge les alertes.");
  }
  const publicKey = await getVapidPublicFn();
  if (!publicKey) throw new Error("Clé de notification absente sur le serveur.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Autorisation refusée.");
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register("/sw.js");
  }
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Abonnement push incomplet.");
  }
  await savePushSubscriptionFn({
    data: {
      userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  });
}

export function usePushNotifications(userId: string | undefined) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    setEnabled(Notification.permission === "granted");
    if (Notification.permission !== "granted") return;
    void subscribePush(userId).catch(() => undefined);
  }, [userId]);

  const enable = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await subscribePush(userId);
      setEnabled(true);
    } finally {
      setBusy(false);
    }
  };

  return { enabled, busy, enable };
}
