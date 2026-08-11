import { createHash } from "node:crypto"
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  INVITE_TTL_DAYS,
  inviteExpiry,
  mintInvite,
  writeInviteFile,
  type InviteLink,
} from "../../scripts/_lib/invites"

function recordingSql() {
  const queries: Array<{ text: string; values: unknown[] }> = []
  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    queries.push({ text: strings.join("?"), values })
    return []
  }
  return { sql, queries }
}

describe("member invites", () => {
  it("stores only a hash of the token it hands out", async () => {
    const { sql, queries } = recordingSql()

    const invite = await mintInvite(
      sql,
      "household-1",
      { id: "member-1", name: "Alex" },
      "https://example.test"
    )

    const token = invite.link.split("#")[1]
    expect(token).toBeTruthy()

    const [insert] = queries
    expect(insert.text).toContain("insert into invites")
    // The raw token must never be a bound parameter, only its digest.
    expect(insert.values).not.toContain(token)
    expect(insert.values).toContain(
      createHash("sha256").update(token).digest("hex")
    )
  })

  it("puts the token in the fragment, which never reaches the server", async () => {
    const { sql } = recordingSql()

    const invite = await mintInvite(
      sql,
      "household-1",
      { id: "member-1", name: "Alex" },
      "https://example.test"
    )

    const url = new URL(invite.link)
    expect(url.pathname).toBe("/join")
    expect(url.search).toBe("")
    expect(url.hash.slice(1)).toHaveLength(43)
  })

  it("mints a different token every time", async () => {
    const { sql } = recordingSql()
    const member = { id: "member-1", name: "Alex" }

    const first = await mintInvite(sql, "h", member, "https://example.test")
    const second = await mintInvite(sql, "h", member, "https://example.test")

    expect(first.link).not.toBe(second.link)
  })

  it("expires invites rather than leaving them live forever", () => {
    const now = new Date("2026-08-11T00:00:00.000Z")
    const expiry = new Date(inviteExpiry(now))

    expect((expiry.getTime() - now.getTime()) / 86_400_000).toBe(
      INVITE_TTL_DAYS
    )
  })

  it("writes the links owner-readable only, even over a loose existing file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rtd-invites-"))
    const target = join(directory, "invite-links.json")
    await writeFile(target, "stale", { mode: 0o644 })

    const links: InviteLink[] = [
      {
        member: "Alex",
        link: "https://example.test/join#token",
        expiresAt: inviteExpiry(),
      },
    ]
    await writeInviteFile(links, target)

    expect((await stat(target)).mode & 0o777).toBe(0o600)
    expect(JSON.parse(await readFile(target, "utf8"))).toEqual(links)
  })
})
