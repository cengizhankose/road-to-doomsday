import { z } from "zod"

export const routeSchema = z.enum(["movies", "series"])
export const catalogKindSchema = z.enum(["movie", "series", "special"])
export const releaseStatusSchema = z.enum(["released", "upcoming"])

export const catalogItemSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  route: routeSchema,
  kind: catalogKindSchema,
  order: z.number().int().positive(),
  year: z.number().int().min(2008),
  releaseStatus: releaseStatusSchema,
  releaseDate: z.string().date().optional(),
  seasonEpisodeCounts: z.array(z.number().int().positive()).min(1).optional(),
})

export const catalogSchema = z.array(catalogItemSchema)

export type Route = z.infer<typeof routeSchema>
export type CatalogItem = z.infer<typeof catalogItemSchema>
export type CatalogKind = z.infer<typeof catalogKindSchema>
export type ReleaseStatus = z.infer<typeof releaseStatusSchema>
