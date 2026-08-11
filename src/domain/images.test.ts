import { describe, expect, it } from "vitest"

import {
  catalogImageSchema,
  fallbackImageUri,
  remoteImageHosts,
} from "@/domain/images"

const cinemetaMapping = {
  catalogId: "iron-man",
  imageUri:
    "https://m.media-amazon.com/images/M/MV5BMTczNTI2ODUwOF5BMl5BanBnXkFtZTcwMTU0NTIzMw@@._V1_SX250.jpg",
  source: "cinemeta",
  sourceId: "tt0371746",
  sourcePageUri: "https://v3-cinemeta.strem.io/meta/movie/tt0371746.json",
  matchedTitle: "Iron Man",
  matchedYear: 2008,
  lastVerifiedAt: "2026-08-11T14:00:00.000Z",
}

describe("catalog image metadata", () => {
  it("accepts a verified Cinemeta poster mapping", () => {
    expect(catalogImageSchema.parse(cinemetaMapping)).toMatchObject({
      catalogId: "iron-man",
      source: "cinemeta",
      sourceId: "tt0371746",
    })
  })

  it("accepts a MetaHub poster", () => {
    expect(
      catalogImageSchema.parse({
        ...cinemetaMapping,
        imageUri: "https://images.metahub.space/poster/medium/tt0371746/img",
      }).imageUri
    ).toContain("images.metahub.space")
  })

  it("accepts a self-hosted fallback for a title with no published artwork", () => {
    expect(
      catalogImageSchema.parse({
        ...cinemetaMapping,
        catalogId: "visionquest",
        imageUri: fallbackImageUri,
        source: "fallback",
        sourceId: "visionquest",
        sourcePageUri: fallbackImageUri,
        matchedTitle: "VisionQuest",
        matchedYear: 2026,
      })
    ).toMatchObject({ source: "fallback", imageUri: fallbackImageUri })
  })

  it("rejects non-https image locations", () => {
    expect(() =>
      catalogImageSchema.parse({
        ...cinemetaMapping,
        imageUri: "http://images.example/iron-man.jpg",
      })
    ).toThrow()
  })

  it.each([
    ["an unexpected remote host", "https://images.example/iron-man.jpg"],
    ["a protocol-relative URL", "//m.media-amazon.com/images/x.jpg"],
    ["a javascript URI", "javascript:alert(1)"],
    ["a data URI", "data:image/svg+xml,<svg/>"],
    ["an empty URI", ""],
  ])("rejects %s so stored rows can never outrun the CSP", (_name, imageUri) => {
    expect(catalogImageSchema.safeParse({ ...cinemetaMapping, imageUri }).success).toBe(
      false
    )
  })

  it("still names TMDB nowhere in the accepted provenance", () => {
    expect(
      catalogImageSchema.safeParse({ ...cinemetaMapping, source: "tmdb" })
        .success
    ).toBe(false)
    expect(remoteImageHosts).not.toContain("image.tmdb.org")
  })
})
