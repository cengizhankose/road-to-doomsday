import { z } from "zod"

import {
  progressRecordSchema,
  type ProgressMap,
  type ProgressRecord,
} from "@/domain/progress"

const progressResponseSchema = z.object({
  items: z.array(progressRecordSchema),
})

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
    async getAll(): Promise<ProgressMap> {
      const response = await fetcher("/api/progress", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      const payload = progressResponseSchema.parse(await parseResponse(response))

      return Object.fromEntries(payload.items.map((item) => [item.catalogId, item]))
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
  }
}

export const progressClient = createProgressClient()
