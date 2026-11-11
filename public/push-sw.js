// Push notifications service worker (separado do SW de offline).
// Escopo: raiz do app. Só trata eventos `push` e `notificationclick`.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Notificação", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Lembrete";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-512.png",
    badge: payload.badge || "/icon-512.png",
    tag: payload.tag || "default",
    data: { url: payload.url || "/home" },
    requireInteraction: !!payload.requireInteraction,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/home";
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      if ("focus" in client) {
        try {
          await client.focus();
          if ("navigate" in client) await client.navigate(targetUrl);
          return;
        } catch { /* ignore */ }
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
