import { catalog } from "@/data/catalog"
import { progressRecordSchema } from "@/domain/progress"

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
