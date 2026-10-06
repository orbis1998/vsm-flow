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

function inferGlyph(title, body) {
  const t = `${title || ""} ${body || ""}`.toLowerCase();
  if (t.includes("échec") || t.includes("echec") || t.includes("échou")) return "warn";
  if (t.includes("livrée") || t.includes("livree")) return "check";
  if (t.includes("stock") || t.includes("dotation")) return "box";
  if (t.includes("assign") || t.includes("en route")) return "bike";
  if (t.includes("corrig")) return "edit";
  return "cart";
}

self.addEventListener("push", (event) => {
  let data = { title: "", body: "", href: "/", glyph: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ignore
  }
  const eventTitle = typeof data.title === "string" ? data.title.trim() : "";
  const eventBody = typeof data.body === "string" ? data.body.trim() : "";
  const glyph = typeof data.glyph === "string" && data.glyph ? data.glyph : inferGlyph(eventTitle, eventBody);
  const origin = self.location.origin;
  event.waitUntil(
    self.registration.showNotification(eventTitle || "Nouvelle activité", {
      body: eventBody || "",
      icon: `${origin}/notify/${glyph}.png`,
      badge: `${origin}/badge-96.png`,
      vibrate: [200, 100, 200],
      requireInteraction: true,
      renotify: true,
      silent: false,
      tag: `vsm-${glyph}-${Date.now()}`,
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
