import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { CatalogPage } from "@/pages/catalog-page"

describe("CatalogPage posters", () => {
  it("renders the verified poster for its catalog item", () => {
    render(
      <MemoryRouter>
        <CatalogPage
          route="movies"
          progress={{}}
          images={{
            "iron-man": {
              catalogId: "iron-man",
              imageUri: "https://m.media-amazon.com/images/M/MV5Bexample._V1_SX250.jpg",
              source: "cinemeta",
              sourceId: "tt0371746",
              sourcePageUri: "https://v3-cinemeta.strem.io/meta/movie/tt0371746.json",
              matchedTitle: "Iron Man",
              matchedYear: 2008,
              lastVerifiedAt: "2026-08-10T14:00:00.000Z",
            },
          }}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("img", { name: "Iron Man poster" })
    ).toHaveAttribute("src", "https://m.media-amazon.com/images/M/MV5Bexample._V1_SX250.jpg")
  })
})
