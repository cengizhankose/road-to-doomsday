import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const enable = vi.fn().mockResolvedValue("granted")
vi.mock("@/lib/push-client", () => ({
  isPushSupported: () => true,
  createPushClient: () => ({ enable }),
}))

import { usePushNotifications } from "@/hooks/use-push-notifications"

describe("usePushNotifications member binding", () => {
  beforeEach(() => {
    localStorage.clear()
    enable.mockReset()
    enable.mockResolvedValue("granted")
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: "push" }) },
        }),
      },
    })
  })

  it("requires a new opt-in when the existing subscription belongs to the other member", async () => {
    localStorage.setItem("rtd-push-member", "member-sinem")
    const { result } = renderHook(() =>
      usePushNotifications("vapid-public-key", "member-cengizhan", "binding-current"),
    )

    await waitFor(() => expect(result.current.subscribed).toBe(false))

    await act(async () => {
      await result.current.enable()
    })

    expect(enable).toHaveBeenCalledWith("vapid-public-key")
    expect(localStorage.getItem("rtd-push-member")).toBe("member-cengizhan")
    expect(result.current.subscribed).toBe(true)
  })
})

describe("usePushNotifications session rebinding", () => {
  beforeEach(() => {
    localStorage.clear()
    enable.mockReset()
    enable.mockResolvedValue("granted")
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "granted", requestPermission: vi.fn() },
    })
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue({ endpoint: "push" }),
          },
        }),
      },
    })
  })

  it("re-registers the device when the session behind its binding has changed", async () => {
    // The device opted in under an earlier session.
    localStorage.setItem("rtd-push-member", "member-cengizhan")
    localStorage.setItem("rtd-push-binding", "binding-from-the-old-session")

    const { result } = renderHook(() =>
      usePushNotifications(
        "vapid-public-key",
        "member-cengizhan",
        "binding-from-the-current-session",
      ),
    )

    // Without this the row stays bound to a dead session and the member
    // silently stops receiving anything, with no way to re-enable.
    await waitFor(() => expect(enable).toHaveBeenCalledWith("vapid-public-key"))
    await waitFor(() => expect(result.current.subscribed).toBe(true))
    expect(localStorage.getItem("rtd-push-binding")).toBe(
      "binding-from-the-current-session",
    )
  })

  it("costs no request when the binding is already current", async () => {
    localStorage.setItem("rtd-push-member", "member-cengizhan")
    localStorage.setItem("rtd-push-binding", "binding-from-the-current-session")

    const { result } = renderHook(() =>
      usePushNotifications(
        "vapid-public-key",
        "member-cengizhan",
        "binding-from-the-current-session",
      ),
    )

    await waitFor(() => expect(result.current.subscribed).toBe(true))
    expect(enable).not.toHaveBeenCalled()
  })

  it("does not re-register a device whose permission was revoked", async () => {
    localStorage.setItem("rtd-push-member", "member-cengizhan")
    localStorage.setItem("rtd-push-binding", "stale")
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "denied", requestPermission: vi.fn() },
    })

    const { result } = renderHook(() =>
      usePushNotifications("vapid-public-key", "member-cengizhan", "current"),
    )

    await waitFor(() => expect(result.current.subscribed).toBe(false))
    expect(enable).not.toHaveBeenCalled()
  })
})

describe("usePushNotifications failure handling", () => {
  const unhandled = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    enable.mockReset()
    window.addEventListener("unhandledrejection", unhandled)
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
      },
    })
  })

  afterEach(() => {
    window.removeEventListener("unhandledrejection", unhandled)
    unhandled.mockClear()
  })

  it("surfaces a failed opt-in as retryable state instead of an unhandled rejection", async () => {
    const failure = new Error("Push subscription failed with 500")
    enable.mockRejectedValueOnce(failure)
    const { result } = renderHook(() =>
      usePushNotifications("vapid-public-key", "member-cengizhan", "binding-current"),
    )

    let returned: boolean | undefined
    await act(async () => {
      // The caller must be able to ignore the result without crashing the tab.
      returned = await result.current.enable()
    })

    expect(returned).toBe(false)
    expect(result.current.error).toBe(failure)
    expect(result.current.enabling).toBe(false)
    expect(result.current.subscribed).toBe(false)
    expect(unhandled).not.toHaveBeenCalled()

    enable.mockResolvedValueOnce("granted")
    await act(async () => {
      await result.current.enable()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.subscribed).toBe(true)
  })

  it("reports an explicit denial as blocked rather than as an error", async () => {
    enable.mockResolvedValue("denied")
    const { result } = renderHook(() =>
      usePushNotifications("vapid-public-key", "member-cengizhan", "binding-current"),
    )

    await act(async () => {
      await result.current.enable()
    })

    expect(result.current.blocked).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.subscribed).toBe(false)
    expect(localStorage.getItem("rtd-push-member")).toBeNull()
  })

  it("does not tell the member to change settings when they merely dismissed the prompt", async () => {
    enable.mockResolvedValue("default")
    const { result } = renderHook(() =>
      usePushNotifications("vapid-public-key", "member-cengizhan", "binding-current"),
    )

    await act(async () => {
      await result.current.enable()
    })

    expect(result.current.blocked).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.subscribed).toBe(false)
  })
})
