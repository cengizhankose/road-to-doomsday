import { describe, expect, it, vi } from "vitest"

import { createPlanNotifier } from "../../../api/_lib/push"

const context = {
  householdId: "household-rtd",
  memberId: "member-cengizhan",
  memberName: "Cengizhan",
  sessionHash: "session-hash",
}

const recipient = {
  endpointHash: "endpoint-hash",
  endpoint: "https://push.example.test/sinem",
  p256dh: "public-key",
  auth: "auth-secret",
}

describe("plan push notifications", () => {
  it("sends the plan only to subscriptions belonging to the other member", async () => {
    const listRecipients = vi.fn().mockResolvedValue([recipient])
    const deliver = vi.fn().mockResolvedValue(undefined)
    const notifier = createPlanNotifier({
      listRecipients,
      deliver,
      remove: vi.fn(),
    })

    await notifier(context, {
      catalogId: "iron-man",
      title: "Iron Man",
      route: "movies",
      plannedAt: "2026-08-14T18:00:00.000Z",
    })

    expect(listRecipients).toHaveBeenCalledWith(
      "household-rtd",
      "member-cengizhan"
    )
    const payload = JSON.parse(deliver.mock.calls[0][1])
    expect(payload).toEqual({
      title: "Cengizhan planned Iron Man",
      plannedAt: "2026-08-14T18:00:00.000Z",
      tag: "plan-iron-man-2026-08-14T18:00:00.000Z",
      url: "/movies/iron-man",
    })
  })

  it("removes subscriptions rejected as gone", async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const notifier = createPlanNotifier({
      listRecipients: vi.fn().mockResolvedValue([recipient]),
      deliver: vi.fn().mockRejectedValue({ statusCode: 410 }),
      remove,
    })

    await notifier(context, {
      catalogId: "iron-man",
      title: "Iron Man",
      route: "movies",
      plannedAt: "2026-08-14T18:00:00.000Z",
    })

    expect(remove).toHaveBeenCalledWith("endpoint-hash")
  })
})
