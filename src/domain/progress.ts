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
    cengizhanScore: z.number().int().min(0).max(10).nullable().optional(),
    sinemScore: z.number().int().min(0).max(10).nullable().optional(),
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

export interface SharedProgressState {
  progress: ProgressMap
  selections: RouteSelections
  images: CatalogImagesMap
  member: { id: string; name: string }
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
