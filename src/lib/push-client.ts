interface PushSubscriptionLike {
  toJSON(): unknown
}

interface PushManagerLike {
  getSubscription(): Promise<PushSubscriptionLike | null>
  subscribe(options: {
    userVisibleOnly: boolean
    applicationServerKey: Uint8Array<ArrayBuffer>
  }): Promise<PushSubscriptionLike>
}

interface PushClientDependencies {
  ready: Promise<{ pushManager: PushManagerLike }>
  requestPermission(): Promise<NotificationPermission>
  fetcher: typeof fetch
}

function decodeApplicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0)
  )
  return new Uint8Array(bytes.buffer)
}

export function createPushClient({
  ready,
  requestPermission,
  fetcher,
}: PushClientDependencies) {
  return {
    /**
     * Returns the permission the member actually gave. `"default"` means they
     * dismissed the prompt and can simply be asked again; only `"denied"` needs
     * a trip to site settings.
     */
    async enable(publicKey: string): Promise<NotificationPermission> {
      const permission = await requestPermission()
      if (permission !== "granted") return permission

      const registration = await ready
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(publicKey),
        }))
      const response = await fetcher("/api/push-subscription", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!response.ok) {
        throw new Error(`Push subscription failed with ${response.status}`)
      }
      return "granted"
    },
  }
}

export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export function createBrowserPushClient() {
  return createPushClient({
    ready: navigator.serviceWorker.ready,
    requestPermission: () => Notification.requestPermission(),
    fetcher: fetch,
  })
}
