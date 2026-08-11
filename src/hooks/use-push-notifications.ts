import { useCallback, useEffect, useState } from "react"

import { createPushClient, isPushSupported } from "@/lib/push-client"

const boundMemberKey = "rtd-push-member"

export function usePushNotifications(publicKey: string | null, memberId: string) {
  const supported = Boolean(publicKey) && isPushSupported()
  const [subscribed, setSubscribed] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (!supported) return
    let active = true
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active) {
          setSubscribed(
            Boolean(subscription) && localStorage.getItem(boundMemberKey) === memberId,
          )
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason)
      })
    return () => {
      active = false
    }
  }, [memberId, supported])

  // Opting in is a user gesture, so a failure belongs on screen as retryable
  // state. Rethrowing here would only become an unhandled rejection in the
  // click handler and leave the member with a button that silently does nothing.
  const enable = useCallback(async () => {
    if (!publicKey || !supported) return false
    setEnabling(true)
    setError(null)
    setBlocked(false)
    try {
      const client = createPushClient({
        ready: navigator.serviceWorker.ready,
        requestPermission: () => Notification.requestPermission(),
        fetcher: fetch,
      })
      const permission = await client.enable(publicKey)
      const enabled = permission === "granted"
      if (enabled) localStorage.setItem(boundMemberKey, memberId)
      setSubscribed(enabled)
      // A dismissed prompt ("default") can just be asked again; only an
      // explicit denial requires the member to change a browser setting.
      setBlocked(permission === "denied")
      return enabled
    } catch (reason) {
      setError(reason)
      setSubscribed(false)
      return false
    } finally {
      setEnabling(false)
    }
  }, [memberId, publicKey, supported])

  return { supported, subscribed, enabling, blocked, enable, error }
}
