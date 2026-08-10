import { z } from "zod"

import { routeSchema } from "@/domain/catalog"
import {
  progressRecordSchema,
  routeSelectionsSchema,
  type ProgressRecord,
  type SharedProgressState,
} from "@/domain/progress"

const progressResponseSchema = z.object({
  items: z.array(progressRecordSchema),
  selections: routeSelectionsSchema,
}).strict()

const selectionSchema = z.object({
  route: routeSchema,
  catalogId: z.string().min(1),
}).strict()

export type Selection = z.infer<typeof selectionSchema>
type Fetcher = typeof fetch

async function parseResponse(response: Response) {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with ${response.status}`)
  }

  return response.json() as Promise<unknown>
}

export function createProgressClient(fetcher: Fetcher = fetch) {
  return {
    async getAll(): Promise<SharedProgressState> {
      const response = await fetcher("/api/progress", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      const payload = progressResponseSchema.parse(await parseResponse(response))

      return {
        progress: Object.fromEntries(
          payload.items.map((item) => [item.catalogId, item]),
        ),
        selections: payload.selections,
      }
    },

    async save(record: ProgressRecord): Promise<ProgressRecord> {
      const response = await fetcher("/api/progress", {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(record),
      })

      return progressRecordSchema.parse(await parseResponse(response))
    },

    async saveSelection(selection: Selection): Promise<Selection> {
      const response = await fetcher("/api/selection", {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selection),
      })

      return selectionSchema.parse(await parseResponse(response))
    },
  }
}

export const progressClient = createProgressClient()
