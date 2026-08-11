import { z } from "zod"

import { routeSchema } from "@/domain/catalog"
import { catalogImageSchema } from "@/domain/images"
import {
  householdMemberSchema,
  progressRecordSchema,
  routeSelectionsSchema,
  type ProgressRecord,
  type SharedProgressState,
} from "@/domain/progress"

/**
 * Rebuilds a schema so it *ignores* keys it does not recognise.
 *
 * A service worker serves the previously cached bundle for at least one
 * navigation after a deploy, so an old client always meets the new API. If
 * these schemas rejected unknown keys, every additive server change would put
 * those clients into the full-screen error gate until their bundle caught up —
 * which is exactly what shipping the `members` field did.
 *
 * This is deliberately one-directional. What the client *sends* stays strict:
 * `progressPatchSchema` and `selectionPatchSchema` reject unknown keys server
 * side, and that is a security boundary, not a compatibility one.
 */
function tolerant<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  return z.object(schema.shape)
}

const progressRecordResponseSchema = tolerant(progressRecordSchema)

const progressResponseSchema = tolerant(
  z.object({
    items: z.array(progressRecordResponseSchema),
    selections: tolerant(routeSelectionsSchema),
    images: z.array(tolerant(catalogImageSchema)),
    member: z.object({ id: z.string().min(1), name: z.string().min(1) }),
    members: z.array(tolerant(householdMemberSchema)),
    push: z.object({
      publicKey: z.string().min(1).nullable(),
      bindingId: z.string().min(1),
    }),
  })
)

const selectionSchema = z.object({
  route: routeSchema,
  catalogId: z.string().min(1),
})

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
  .object({ error: z.string(), current: progressRecordResponseSchema.nullable() })
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
        members: [...payload.members].sort((left, right) => left.slot - right.slot),
        pushPublicKey: payload.push.publicKey,
        pushBindingId: payload.push.bindingId,
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

      return progressRecordResponseSchema.parse(await parseResponse(response))
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

      return progressRecordResponseSchema.parse(await parseResponse(response))
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
