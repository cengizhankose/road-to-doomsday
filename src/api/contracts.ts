import { z } from "zod"

import { catalog } from "../data/catalog.js"
import { routeSchema } from "../domain/catalog.js"
import { progressRecordSchema } from "../domain/progress.js"

const catalogIds = new Set(catalog.map((item) => item.id))

export const progressPatchSchema = progressRecordSchema.superRefine(
  (record, context) => {
    if (!catalogIds.has(record.catalogId)) {
      context.addIssue({
        code: "custom",
        path: ["catalogId"],
        message: "Unknown catalog item",
      })
    }
  },
)

export const selectionPatchSchema = z
  .object({
    route: routeSchema,
    catalogId: z.string().min(1),
  })
  .strict()
  .superRefine((selection, context) => {
    const item = catalog.find((entry) => entry.id === selection.catalogId)
    if (!item || item.route !== selection.route) {
      context.addIssue({
        code: "custom",
        path: ["catalogId"],
        message: "Catalog item does not belong to this route",
      })
    }
  })
