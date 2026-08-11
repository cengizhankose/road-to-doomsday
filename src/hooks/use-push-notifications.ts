import { useCallback, useEffect, useState } from "react"

import { createPushClient, isPushSupported } from "@/lib/push-client"

const boundMemberKey = "rtd-push-member"
const boundSessionKey = "rtd-push-binding"

function pushClient() {
  return createPushClient({
    ready: navigator.serviceWorker.ready,
    requestPermission: () => Notification.requestPermission(),
    fetcher: fetch,
  })
}

export function usePushNotifications(
  publicKey: string | null,
  memberId: string,
  bindingId: string
) {
  const supported = Boolean(publicKey) && isPushSupported()
  const [subscribed, setSubscribed] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState<unknown>(null)

  /*
   * A stored subscription is bound server-side to the session that registered
   * it, and that session is replaced whenever a member opens a fresh magic
   * link. Left alone, the row would stay attached to the dead session and the
   * member would silently stop receiving anything, with the Enable button
   * hidden because the browser still reports a subscription.
   *
   * So on load, a device whose binding no longer matches the current session
   * re-registers itself. When the binding is already current — the overwhelming
   * majority of loads — this costs no request at all.
   */
  useEffect(() => {
    if (!supported || !publicKey) return
    let active = true

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        const boundToThisMember =
          localStorage.getItem(boundMemberKey) === memberId

        if (!subscription || !boundToThisMember) {
          if (active) setSubscribed(false)
          return
        }
        // Re-registering needs no prompt, but it must not resurrect a device
        // whose owner has since turned notifications off in the browser.
        if (Notification.permission !== "granted") {
          if (active) setSubscribed(false)
          return
        }
        if (localStorage.getItem(boundSessionKey) === bindingId) {
          if (active) setSubscribed(true)
          return
        }

        const permission = await pushClient().enable(publicKey)
        const enabled = permission === "granted"
        if (enabled) localStorage.setItem(boundSessionKey, bindingId)
        if (active) setSubscribed(enabled)
      } catch (reason) {
        if (active) setError(reason)
      }
    })()

    return () => {
      active = false
    }
  }, [bindingId, memberId, publicKey, supported])

  // Opting in is a user gesture, so a failure belongs on screen as retryable
  // state. Rethrowing here would only become an unhandled rejection in the
  // click handler and leave the member with a button that silently does nothing.
  const enable = useCallback(async () => {
    if (!publicKey || !supported) return false
    setEnabling(true)
    setError(null)
    setBlocked(false)
    try {
      const permission = await pushClient().enable(publicKey)
      const enabled = permission === "granted"
      if (enabled) {
        localStorage.setItem(boundMemberKey, memberId)
        localStorage.setItem(boundSessionKey, bindingId)
      }
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
  }, [bindingId, memberId, publicKey, supported])

  return { supported, subscribed, enabling, blocked, enable, error }
}
