import { readFileSync } from "node:fs"
import vm from "node:vm"

import { describe, expect, it, vi } from "vitest"

describe("push service worker", () => {
  it("shows a plan notification that opens the planned title", async () => {
    const listeners = new Map<string, (event: never) => void>()
    const showNotification = vi.fn().mockResolvedValue(undefined)
    const source = readFileSync(`${process.cwd()}/public/push-sw.js`, "utf8")
    vm.runInNewContext(source, {
      self: {
        addEventListener: (name: string, listener: (event: never) => void) =>
          listeners.set(name, listener),
        registration: { showNotification },
      },
      Intl,
      Date,
    })
    let pending: Promise<unknown> | undefined
    const payload = {
      title: "Sinem planned Iron Man",
      plannedAt: "2026-08-14T18:00:00.000Z",
      url: "/movies/iron-man",
    }

    listeners.get("push")?.({
      data: { json: () => payload },
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise
      },
    } as never)
    await pending

    expect(showNotification).toHaveBeenCalledWith(
      payload.title,
      expect.objectContaining({ data: { url: payload.url } })
    )
  })

  it.each([
    ["a same-origin path", "/series/loki", "https://rtd.test/series/loki"],
    ["an off-origin absolute URL", "https://evil.example/steal", "https://rtd.test/"],
    ["a protocol-relative URL", "//evil.example/steal", "https://rtd.test/"],
    ["no url at all", undefined, "https://rtd.test/"],
  ])("opens %s inside the app only", async (_name, url, expected) => {
    const listeners = new Map<string, (event: never) => void>()
    const openWindow = vi.fn().mockResolvedValue(undefined)
    const source = readFileSync(`${process.cwd()}/public/push-sw.js`, "utf8")
    vm.runInNewContext(source, {
      self: {
        addEventListener: (name: string, listener: (event: never) => void) =>
          listeners.set(name, listener),
        location: { origin: "https://rtd.test" },
        registration: { showNotification: vi.fn() },
        clients: { matchAll: vi.fn().mockResolvedValue([]), openWindow },
      },
      URL,
      Intl,
      Date,
    })

    let pending: Promise<unknown> | undefined
    listeners.get("notificationclick")?.({
      notification: { close: vi.fn(), data: url === undefined ? {} : { url } },
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise
      },
    } as never)
    await pending

    expect(openWindow).toHaveBeenCalledWith(expected)
  })
})
