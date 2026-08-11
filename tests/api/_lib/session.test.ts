import { describe, expect, it, vi } from "vitest"

import { createSessionAuthorizer } from "../../../api/_lib/session"
import { hashToken } from "../../../api/_lib/auth"
import type { VercelRequest } from "../../../api/_lib/types"

function request(cookie?: string): VercelRequest {
  return {
    method: "GET",
    headers: cookie ? { cookie } : {},
    query: {},
    body: undefined,
  }
}

describe("session authorization", () => {
  it("maps the opaque cookie hash to its household member", async () => {
    const identity = {
      householdId: "household-rtd",
      memberId: "member-cengizhan",
      memberName: "Cengizhan",
    }
    const lookup = vi.fn().mockResolvedValue(identity)
    const authorize = createSessionAuthorizer(lookup)

    await expect(
      authorize(request("__Host-rtd_session=opaque-session"))
    ).resolves.toEqual({
      ...identity,
      sessionHash: hashToken("opaque-session"),
    })
    expect(lookup).toHaveBeenCalledWith(hashToken("opaque-session"))
  })

  it("rejects missing or expired sessions", async () => {
    const lookup = vi.fn().mockResolvedValue(null)
    const authorize = createSessionAuthorizer(lookup)

    await expect(authorize(request())).resolves.toBeNull()
    await expect(
      authorize(request("__Host-rtd_session=expired"))
    ).resolves.toBeNull()
    expect(lookup).toHaveBeenCalledOnce()
  })
})
