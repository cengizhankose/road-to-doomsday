/**
 * Regression tests for the hard-refresh lockout.
 *
 * A service worker keeps serving the previously precached bundle until it is
 * replaced, so for at least one navigation after every deploy an *old* client
 * talks to the *new* API. When the release that added `members` to
 * `GET /api/progress` shipped, that old client parsed the response with a
 * `.strict()` schema, threw on the unrecognised key, and set the initial query
 * into an error state — which renders the full-screen "Couldn't load the
 * tracker" gate. The session cookie was valid and the server answered 200 the
 * whole time; only the client refused the payload.
 *
 * The invariant these tests pin down: **the client must ignore fields it does
 * not know about anywhere in an API response.** Additive server changes are
 * then safe for every already-deployed bundle.
 *
 * The opposite rule still applies to what the client *sends* — see the final
 * test, which guards the strictness of the write contract.
 */
import { describe, expect, it, vi } from "vitest"

import { progressPatchSchema } from "@/api/contracts"
import { createProgressClient } from "@/lib/progress-client"

const image = {
  catalogId: "iron-man",
  imageUri: "https://m.media-amazon.com/images/M/MV5Bexample._V1_SX250.jpg",
  source: "cinemeta",
  sourceId: "tt0371746",
  sourcePageUri: "https://v3-cinemeta.strem.io/meta/movie/tt0371746.json",
  matchedTitle: "Iron Man",
  matchedYear: 2008,
  lastVerifiedAt: "2026-08-10T14:00:00.000Z",
}

const record = {
  catalogId: "iron-man",
  status: "watched" as const,
  memberOneScore: 8,
  memberTwoScore: 7,
  currentSeason: null,
  currentEpisode: null,
  plannedAt: null,
  watchedOn: "2026-08-10",
  note: null,
  revision: 3,
}

/** The response shape as of today, plus whatever a future release adds. */
function futureResponse(extra: Record<string, unknown> = {}) {
  return {
    items: [record],
    selections: { movies: "iron-man", series: null },
    images: [image],
    member: { id: "member-1", name: "Alex" },
    members: [
      { id: "member-1", name: "Alex", slot: 1 },
      { id: "member-2", name: "Sam", slot: 2 },
    ],
    push: { publicKey: "vapid-public-key", bindingId: "binding-abc" },
    ...extra,
  }
}

function jsonFetcher(body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  )
}

describe("API response forward compatibility", () => {
  it("ignores a new top-level field a later release adds", async () => {
    const client = createProgressClient(
      jsonFetcher(futureResponse({ household: { id: "h1", name: "Movie Night" } }))
    )

    const state = await client.getAll()

    expect(state.progress["iron-man"]?.revision).toBe(3)
    expect(state.members.map((m) => m.name)).toEqual(["Alex", "Sam"])
  })

  it("ignores a new field inside a progress record", async () => {
    const client = createProgressClient(
      jsonFetcher(
        futureResponse({ items: [{ ...record, ratedByBoth: true }] })
      )
    )

    const state = await client.getAll()

    expect(state.progress["iron-man"]?.status).toBe("watched")
  })

  it("ignores new fields inside the member, members, and push objects", async () => {
    const client = createProgressClient(
      jsonFetcher(
        futureResponse({
          member: { id: "member-1", name: "Alex", avatarUrl: "/a.png" },
          members: [
            { id: "member-1", name: "Alex", slot: 1, avatarUrl: "/a.png" },
            { id: "member-2", name: "Sam", slot: 2, avatarUrl: "/s.png" },
          ],
          push: {
            publicKey: "vapid-public-key",
            bindingId: "binding-abc",
            protocol: "web-push-2",
          },
        })
      )
    )

    const state = await client.getAll()

    expect(state.member.name).toBe("Alex")
    expect(state.members).toHaveLength(2)
    expect(state.pushBindingId).toBe("binding-abc")
  })

  it("ignores a new field in a save response", async () => {
    const client = createProgressClient(
      jsonFetcher({ ...record, revision: 4, updatedBy: "member-1" })
    )

    const saved = await client.save({ ...record, revision: 3 })

    expect(saved.revision).toBe(4)
  })

  it("ignores a new field in a schedule response", async () => {
    const client = createProgressClient(
      jsonFetcher({ ...record, revision: 4, notificationQueued: true })
    )

    const saved = await client.schedule({ ...record, revision: 3 })

    expect(saved.revision).toBe(4)
  })

  it("ignores a new field in a selection response", async () => {
    const client = createProgressClient(
      jsonFetcher({ route: "movies", catalogId: "iron-man", pinned: false })
    )

    const saved = await client.saveSelection({
      route: "movies",
      catalogId: "iron-man",
    })

    expect(saved).toEqual({ route: "movies", catalogId: "iron-man" })
  })

  it("still rejects unknown fields on the way IN, which is a security boundary", () => {
    // Loosening responses must never loosen what the server accepts: the PATCH
    // body schema is what stops a client writing columns it has no business
    // touching.
    expect(
      progressPatchSchema.safeParse({ ...record, revision: 1 }).success
    ).toBe(true)
    expect(
      progressPatchSchema.safeParse({
        ...record,
        revision: 1,
        householdId: "someone-elses-household",
      }).success
    ).toBe(false)
  })
})
