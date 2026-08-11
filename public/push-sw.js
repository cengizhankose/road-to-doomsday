self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? {}
  const plannedAt = payload.plannedAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(payload.plannedAt))
    : "Open Road to Doomsday for details"

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Road to Doomsday", {
      body: plannedAt,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag ?? "rtd-plan",
      data: { url: payload.url ?? "/" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  // Only ever navigate inside this app, whatever the payload claims.
  const requested = new URL(event.notification.data?.url ?? "/", self.location.origin)
  const targetUrl =
    requested.origin === self.location.origin
      ? requested.href
      : new URL("/", self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === targetUrl)
      if (existing) return existing.focus()
      return self.clients.openWindow(targetUrl)
    }),
  )
})
