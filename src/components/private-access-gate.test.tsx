import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PrivateAccessGate } from "@/components/private-access-gate"
import { HttpError } from "@/lib/progress-client"

describe("PrivateAccessGate", () => {
  it("hides the tracker when the session is missing", () => {
    render(
      <PrivateAccessGate
        loading={false}
        error={new HttpError(401, "Private link required")}
      >
        <button type="button">Save progress</button>
      </PrivateAccessGate>
    )

    expect(
      screen.getByRole("heading", { name: "Private link required" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Save progress" })
    ).not.toBeInTheDocument()
  })

  it("renders the tracker for an authenticated session", () => {
    render(
      <PrivateAccessGate loading={false} error={null}>
        <button type="button">Save progress</button>
      </PrivateAccessGate>
    )

    expect(
      screen.getByRole("button", { name: "Save progress" })
    ).toBeInTheDocument()
  })
})
