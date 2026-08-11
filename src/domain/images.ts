import { z } from "zod"

/**
 * Poster artwork comes from the keyless Cinemeta catalog, which serves images
 * from exactly these two hosts. Keeping the list here — rather than only in the
 * CSP — means a stored row can never point the app at an origin the browser
 * would refuse to load anyway.
 */
export const remoteImageHosts = [
  "m.media-amazon.com",
  "images.metahub.space",
] as const

/** Self-hosted placeholder for titles with no published artwork yet. */
export const fallbackImageUri = "/posters/fallback.svg"

const imageLocationSchema = z
  .string()
  .min(1)
  .max(2_048)
  .refine((value) => {
    if (value === fallbackImageUri) return true
    let url: URL
    try {
      url = new URL(value)
    } catch {
      return false
    }
    return (
      url.protocol === "https:" &&
      (remoteImageHosts as readonly string[]).includes(url.hostname)
    )
  }, "Expected an HTTPS URL on a known artwork host, or the local fallback asset")

export const catalogImageSchema = z
  .object({
    catalogId: z.string().min(1),
    imageUri: imageLocationSchema,
    source: z.enum(["cinemeta", "fallback"]),
    /** IMDb id for Cinemeta rows, catalog id for fallback rows. */
    sourceId: z.string().min(1),
    sourcePageUri: z
      .string()
      .min(1)
      .max(2_048)
      .refine((value) => {
        if (value === fallbackImageUri) return true
        try {
          return new URL(value).protocol === "https:"
        } catch {
          return false
        }
      }, "Expected an HTTPS provenance URL, or the local fallback asset"),
    matchedTitle: z.string().min(1),
    matchedYear: z.number().int().min(1900),
    lastVerifiedAt: z.iso.datetime(),
  })
  .strict()

export const catalogImagesSchema = z.array(catalogImageSchema)

export type CatalogImage = z.infer<typeof catalogImageSchema>
export type CatalogImagesMap = Record<string, CatalogImage>
