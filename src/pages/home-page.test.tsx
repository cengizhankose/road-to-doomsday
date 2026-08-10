import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { HomePage } from "@/pages/home-page"

describe("HomePage", () => {
  it("shows independent next-up cards for movies and series", () => {
    render(
      <MemoryRouter>
        <HomePage progress={{}} selections={{ movies: "iron-man", series: "daredevil" }} onRefresh={vi.fn()} refreshing={false} />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole("heading", { name: /road to doomsday/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("Movie Route")).toBeInTheDocument()
    expect(screen.getByText("Series Route")).toBeInTheDocument()
    expect(screen.getByText("Iron Man")).toBeInTheDocument()
    expect(screen.getByText("Daredevil")).toBeInTheDocument()
  })

  it("does not invent a next item when neither route is selected", () => {
    render(
      <MemoryRouter>
        <HomePage
          progress={{}}
          selections={{ movies: null, series: null }}
          onRefresh={vi.fn()}
          refreshing={false}
        />
      </MemoryRouter>,
    )

    expect(screen.getAllByText("Choose from route")).toHaveLength(2)
    expect(screen.queryByText("Iron Man")).not.toBeInTheDocument()
  })

  it("links each route card to its own catalog", () => {
    render(
      <MemoryRouter>
        <HomePage progress={{}} selections={{ movies: "iron-man", series: "daredevil" }} onRefresh={vi.fn()} refreshing={false} />
      </MemoryRouter>,
    )

    expect(screen.getByRole("link", { name: /open movie route/i })).toHaveAttribute(
      "href",
      "/movies",
    )
    expect(screen.getByRole("link", { name: /open series route/i })).toHaveAttribute(
      "href",
      "/series",
    )
  })

  it("offers manual refresh without polling", () => {
    const refresh = vi.fn()
    render(
      <MemoryRouter>
        <HomePage progress={{}} selections={{ movies: "iron-man", series: "daredevil" }} onRefresh={refresh} refreshing={false} />
      </MemoryRouter>,
    )

    screen.getByRole("button", { name: /refresh shared progress/i }).click()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
