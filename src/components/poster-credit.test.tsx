import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PosterCredit } from "@/components/poster-credit"

describe("PosterCredit", () => {
  it("credits the catalog the artwork actually comes from", () => {
    render(<PosterCredit />)

    const credits = screen.getByRole("region", { name: /artwork credits/i })
    expect(credits).toHaveTextContent(/cinemeta/i)
    expect(credits).not.toHaveTextContent(/tmdb/i)
  })
})
