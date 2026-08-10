import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createSessionToken,
  hasAllowedOrigin,
  hashToken,
  readSessionToken,
  sessionCookie,
} from "../../../api/_lib/auth"
import type { VercelRequest } from "../../../api/_lib/types"

function request(headers: VercelRequest["headers"]): VercelRequest {
  return { method: "GET", headers, query: {}, body: undefined }
}

describe("capability link auth", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("hashes credentials without storing the original value", () => {
    const token = "invite-secret"
    const hash = hashToken(token)

    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toContain(token)
    expect(hashToken(token)).toBe(hash)
  })

  it("creates an independent 256-bit session credential", () => {
    const first = createSessionToken()
    const second = createSessionToken()

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).not.toBe(first)
  })

  it("sets a strict hardened host cookie for the opaque session", () => {
    const token = createSessionToken()
    const cookie = sessionCookie(token)

    expect(cookie).toContain(`__Host-rtd_session=${token}`)
    expect(cookie).toContain("Path=/")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain("SameSite=Strict")
    expect(cookie).not.toContain("Domain=")
  })

  it("reads only the host session cookie", () => {
    expect(
      readSessionToken(
        request({ cookie: "other=x; __Host-rtd_session=opaque-token" }),
      ),
    ).toBe("opaque-token")
    expect(readSessionToken(request({ cookie: "other=x" }))).toBeNull()
  })

  it("accepts only the fixed configured origin", () => {
    vi.stubEnv("APP_ORIGIN", "https://road-to-doomsday.vercel.app")

    expect(
      hasAllowedOrigin(
        request({ origin: "https://road-to-doomsday.vercel.app" }),
      ),
    ).toBe(true)
    expect(
      hasAllowedOrigin(
        request({
          host: "road-to-doomsday.vercel.app",
          origin: "https://evil.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(false)
    expect(readSessionToken(request({}))).toBeNull()
    expect(hasAllowedOrigin(request({}))).toBe(false)
  })
})
