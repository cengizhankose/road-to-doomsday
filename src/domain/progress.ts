import { z } from "zod"

import type { CatalogItem, Route } from "@/domain/catalog"

export const watchStatusSchema = z.enum([
  "not_started",
  "planned",
  "watching",
  "watched",
  "skipped",
])

export const progressRecordSchema = z.object({
  catalogId: z.string().min(1),
  status: watchStatusSchema,
  cengizhanScore: z.number().min(0).max(10).nullable().optional(),
  sinemScore: z.number().min(0).max(10).nullable().optional(),
  currentSeason: z.number().int().positive().nullable().optional(),
  currentEpisode: z.number().int().positive().nullable().optional(),
  plannedAt: z.string().nullable().optional(),
  watchedOn: z.string().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  revision: z.number().int().nonnegative(),
})

export type WatchStatus = z.infer<typeof watchStatusSchema>
export type ProgressRecord = z.infer<typeof progressRecordSchema>

export type ProgressMap = Record<string, ProgressRecord>

export function getRouteNextItem(
  items: CatalogItem[],
  progress: ProgressMap,
  route: Route,
): CatalogItem | undefined {
  return items
    .filter((item) => item.route === route)
    .sort((a, b) => a.order - b.order)
    .find((item) => {
      const status = progress[item.id]?.status ?? "not_started"
      return status !== "watched" && status !== "skipped"
    })
}

export function getRouteCompletion(
  items: CatalogItem[],
  progress: ProgressMap,
  route: Route,
) {
  const routeItems = items.filter((item) => item.route === route)
  const watched = routeItems.filter(
    (item) => progress[item.id]?.status === "watched",
  ).length
  const total = routeItems.length

  return {
    watched,
    total,
    percent: total === 0 ? 0 : Math.round((watched / total) * 100),
  }
}

export function normalizeScore(score: number): number {
  return Math.min(10, Math.max(0, score))
}

export function normalizeSeriesPosition(
  item: CatalogItem,
  season: number,
  episode: number,
) {
  const counts = item.seasonEpisodeCounts
  if (!counts?.length) {
    return { currentSeason: null, currentEpisode: null }
  }

  const currentSeason = Math.min(counts.length, Math.max(1, Math.trunc(season)))
  const maxEpisode = counts[currentSeason - 1]
  const currentEpisode = Math.min(
    maxEpisode,
    Math.max(1, Math.trunc(episode)),
  )

  return { currentSeason, currentEpisode }
}
