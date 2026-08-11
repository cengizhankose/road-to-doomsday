import { describe, expect, it, vi } from "vitest"

import { createPushClient } from "@/lib/push-client"

describe("push client", () => {
  it("does not create a subscription when permission is denied", async () => {
    const fetcher = vi.fn()
    const subscribe = vi.fn()
    const client = createPushClient({
      ready: Promise.resolve({
        pushManager: { getSubscription: vi.fn(), subscribe },
      }),
      requestPermission: vi.fn().mockResolvedValue("denied"),
      fetcher,
    })

    await expect(client.enable("BEl6-public-key")).resolves.toBe("denied")
    expect(subscribe).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("registers one browser subscription with the private API", async () => {
    const payload = {
      endpoint: "https://push.example/subscription",
      keys: { p256dh: "public-key", auth: "auth-secret" },
    }
    const subscription = { toJSON: () => payload }
    const subscribe = vi.fn().mockResolvedValue(subscription)
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    const client = createPushClient({
      ready: Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(null),
          subscribe,
        },
      }),
      requestPermission: vi.fn().mockResolvedValue("granted"),
      fetcher,
    })

    await expect(client.enable("BEl6-public-key")).resolves.toBe("granted")
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    )
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith(
      "/api/push-subscription",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    )
  })
})
