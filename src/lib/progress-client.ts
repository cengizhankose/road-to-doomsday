import { z } from "zod"

import { routeSchema } from "@/domain/catalog"
import { catalogImagesSchema } from "@/domain/images"
import {
  progressRecordSchema,
  routeSelectionsSchema,
  type ProgressRecord,
  type SharedProgressState,
} from "@/domain/progress"

const progressResponseSchema = z
  .object({
    items: z.array(progressRecordSchema),
    selections: routeSelectionsSchema,
    images: catalogImagesSchema,
    member: z
      .object({ id: z.string().min(1), name: z.string().min(1) })
      .strict(),
    push: z.object({ publicKey: z.string().min(1).nullable() }).strict(),
  })
  .strict()

const selectionSchema = z
  .object({
    route: routeSchema,
    catalogId: z.string().min(1),
  })
  .strict()

export type Selection = z.infer<typeof selectionSchema>
type Fetcher = typeof fetch

export class HttpError extends Error {
  readonly status: number
  /** Parsed error body, when the server sent JSON. A 409 carries `current`. */
  readonly body: unknown

  constructor(status: number, message: string, body: unknown = null) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.body = body
  }
}

const conflictBodySchema = z
  .object({ error: z.string(), current: progressRecordSchema.nullable() })
  .loose()

/** The record the server reports as authoritative when a save loses a race. */
export function conflictRecord(error: unknown): ProgressRecord | null {
  if (!(error instanceof HttpError) || error.status !== 409) return null
  const parsed = conflictBodySchema.safeParse(error.body)
  return parsed.success ? parsed.data.current : null
}

async function parseResponse(response: Response) {
  if (!response.ok) {
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      // A non-JSON error body is still worth reporting by status alone.
    }
    throw new HttpError(
      response.status,
      text || `Request failed with ${response.status}`,
      body
    )
  }

  return response.json() as Promise<unknown>
}

// Resolved per call rather than captured at module load, so the client always
// uses the ambient fetch instead of a stale reference.
const globalFetcher: Fetcher = (input, init) => globalThis.fetch(input, init)

export function createProgressClient(fetcher: Fetcher = globalFetcher) {
  return {
    async getAll(): Promise<SharedProgressState> {
      const response = await fetcher("/api/progress", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      const payload = progressResponseSchema.parse(
        await parseResponse(response)
      )

      return {
        progress: Object.fromEntries(
          payload.items.map((item) => [item.catalogId, item])
        ),
        selections: payload.selections,
        images: Object.fromEntries(
          payload.images.map((image) => [image.catalogId, image])
        ),
        member: payload.member,
        pushPublicKey: payload.push.publicKey,
      }
    },

    async schedule(record: ProgressRecord): Promise<ProgressRecord> {
      const response = await fetcher("/api/progress", {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-RTD-Notify-Plan": "1",
        },
        body: JSON.stringify(record),
      })

      return progressRecordSchema.parse(await parseResponse(response))
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
