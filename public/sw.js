const APP_NAME = "Business Suite";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((r) => r || Response.error())),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "", body: "Nouvelle activité", href: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ignore
  }
  const eventTitle = typeof data.title === "string" ? data.title.trim() : "";
  const eventBody = typeof data.body === "string" ? data.body.trim() : "";
  const lines = [eventTitle && eventTitle !== APP_NAME ? eventTitle : "", eventBody].filter(Boolean);
  event.waitUntil(
    self.registration.showNotification(APP_NAME, {
      body: lines.join("\n") || "Nouvelle activité",
      icon: `${self.location.origin}/icon-192.png`,
      vibrate: [200, 100, 200],
      requireInteraction: true,
      renotify: true,
      silent: false,
      tag: "vsm-flow",
      timestamp: Date.now(),
      data: { href: data.href || "/commandes" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/commandes";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate?.(href);
          return client.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
