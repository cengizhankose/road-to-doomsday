import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  hasSameOrigin,
  inviteTokenMatches,
  isAuthorized,
  sessionCookie,
  sessionValue,
} from "./auth"
import type { VercelRequest } from "./types"

const token = "0123456789abcdef0123456789abcdef"

function request(headers: VercelRequest["headers"]): VercelRequest {
  return { method: "GET", headers, query: {}, body: undefined }
}

describe("capability link auth", () => {
  beforeEach(() => vi.stubEnv("INVITE_TOKEN", token))
  afterEach(() => vi.unstubAllEnvs())

  it("matches only the configured invite token", () => {
    expect(inviteTokenMatches(token)).toBe(true)
    expect(inviteTokenMatches(`${token}x`)).toBe(false)
  })

  it("creates and verifies a hardened host cookie", () => {
    expect(sessionCookie()).toContain("HttpOnly; Secure; SameSite=Lax")
    expect(
      isAuthorized(
        request({ cookie: `__Host-rtd_session=${sessionValue()}` }),
      ),
    ).toBe(true)
    expect(isAuthorized(request({ cookie: "__Host-rtd_session=bad" }))).toBe(false)
  })

  it("accepts only the request host as write origin", () => {
    expect(
      hasSameOrigin(
        request({
          host: "road-to-doomsday.vercel.app",
          origin: "https://road-to-doomsday.vercel.app",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(true)
    expect(
      hasSameOrigin(
        request({
          host: "road-to-doomsday.vercel.app",
          origin: "https://evil.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(false)
  })
})
