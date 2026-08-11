import { z } from "zod"

import type { CatalogItem, Route } from "./catalog.js"
import type { CatalogImagesMap } from "./images.js"

export const watchStatusSchema = z.enum([
  "not_started",
  "planned",
  "watching",
  "watched",
  "skipped",
])

export const progressRecordSchema = z
  .object({
    catalogId: z.string().min(1),
    status: watchStatusSchema,
    memberOneScore: z.number().int().min(0).max(10).nullable().optional(),
    memberTwoScore: z.number().int().min(0).max(10).nullable().optional(),
    currentSeason: z.number().int().positive().nullable().optional(),
    currentEpisode: z.number().int().positive().nullable().optional(),
    // A plan is an unambiguous instant: UTC or an explicit offset, never a
    // floating local datetime the server would have to guess a zone for.
    plannedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    watchedOn: z.iso.date().nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
    revision: z.number().int().nonnegative(),
  })
  .strict()

export type WatchStatus = z.infer<typeof watchStatusSchema>
export type ProgressRecord = z.infer<typeof progressRecordSchema>

export type ProgressMap = Record<string, ProgressRecord>

/**
 * A household holds exactly two members, and `slot` says which of the two
 * score fields on a progress record belongs to each. Display names are data,
 * so the UI never has to know who a fork's two people are.
 */
export const memberSlotSchema = z.union([z.literal(1), z.literal(2)])

export const householdMemberSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slot: memberSlotSchema,
  })
  .strict()

export type MemberSlot = z.infer<typeof memberSlotSchema>
export type HouseholdMember = z.infer<typeof householdMemberSchema>

/** The score field a member's slot owns, so callers never hardcode the pair. */
export const scoreFieldBySlot = {
  1: "memberOneScore",
  2: "memberTwoScore",
} as const satisfies Record<MemberSlot, keyof ProgressRecord>

export function memberBySlot(
  members: HouseholdMember[],
  slot: MemberSlot
): HouseholdMember | undefined {
  return members.find((member) => member.slot === slot)
}

/** Falls back to a neutral label so a half-configured household still renders. */
export function memberLabel(
  members: HouseholdMember[],
  slot: MemberSlot
): string {
  return memberBySlot(members, slot)?.name ?? `Member ${slot}`
}

export interface SharedProgressState {
  progress: ProgressMap
  selections: RouteSelections
  images: CatalogImagesMap
  /** The member reading this state. */
  member: { id: string; name: string }
  /** Both members, ordered by slot, for labelling the two score fields. */
  members: HouseholdMember[]
  pushPublicKey: string | null
  /** Identifies the session this state was loaded under. */
  pushBindingId: string
}

export const routeSelectionsSchema = z
  .object({
    movies: z.string().nullable(),
    series: z.string().nullable(),
  })
  .strict()

export type RouteSelections = z.infer<typeof routeSelectionsSchema>

export function getSelectedRouteItem(
  items: CatalogItem[],
  selections: RouteSelections,
  route: Route
): CatalogItem | undefined {
  const selectedId = selections[route]
  return selectedId
    ? items.find((item) => item.id === selectedId && item.route === route)
    : undefined
}

export function getRouteCompletion(
  items: CatalogItem[],
  progress: ProgressMap,
  route: Route
) {
  const routeItems = items.filter((item) => item.route === route)
  const watched = routeItems.filter(
    (item) => progress[item.id]?.status === "watched"
  ).length
  const total = routeItems.length

  return {
    watched,
    total,
    percent: total === 0 ? 0 : Math.round((watched / total) * 100),
  }
}

export function shouldNotifyPlan(
  previous: ProgressRecord | undefined,
  next: ProgressRecord,
) {
  if (next.status !== "planned" || !next.plannedAt) return false
  return (
    previous?.status !== "planned" ||
    previous.plannedAt !== next.plannedAt
  )
}

/**
 * The record as it looks with its plan removed.
 *
 * `planned` is the one status that only makes sense alongside a date, so it
 * retires with the date. Any other status describes where the title actually
 * is — the plan was just a note about when — and survives untouched, as does
 * every other field, including the revision the write must land against.
 */
export function clearedPlan(record: ProgressRecord): ProgressRecord {
  return {
    ...record,
    plannedAt: null,
    status: record.status === "planned" ? "not_started" : record.status,
  }
}

export function normalizeScore(score: number): number {
  return Math.min(10, Math.max(0, score))
}

export function normalizeSeriesPosition(
  item: CatalogItem,
  season: number,
  episode: number
) {
  const counts = item.seasonEpisodeCounts
  if (!counts?.length) {
    return { currentSeason: null, currentEpisode: null }
  }

  const currentSeason = Math.min(counts.length, Math.max(1, Math.trunc(season)))
  const maxEpisode = counts[currentSeason - 1]
  const currentEpisode = Math.min(maxEpisode, Math.max(1, Math.trunc(episode)))

  return { currentSeason, currentEpisode }
}
