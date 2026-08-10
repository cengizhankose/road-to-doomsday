import { describe, expect, it, vi } from "vitest"

import { createSessionAuthorizer } from "./session"
import { hashToken } from "./auth"
import type { VercelRequest } from "./types"

function request(cookie?: string): VercelRequest {
  return { method: "GET", headers: cookie ? { cookie } : {}, query: {}, body: undefined }
}

describe("session authorization", () => {
  it("maps the opaque cookie hash to its household", async () => {
    const lookup = vi.fn().mockResolvedValue("household-rtd")
    const authorize = createSessionAuthorizer(lookup)

    await expect(
      authorize(request("__Host-rtd_session=opaque-session")),
    ).resolves.toBe("household-rtd")
    expect(lookup).toHaveBeenCalledWith(hashToken("opaque-session"))
  })

  it("rejects missing or expired sessions", async () => {
    const lookup = vi.fn().mockResolvedValue(null)
    const authorize = createSessionAuthorizer(lookup)

    await expect(authorize(request())).resolves.toBeNull()
    await expect(
      authorize(request("__Host-rtd_session=expired")),
    ).resolves.toBeNull()
    expect(lookup).toHaveBeenCalledOnce()
  })
})
