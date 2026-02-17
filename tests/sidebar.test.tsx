// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import App from "../src/App"

vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) => (
    <textarea
      aria-label="Code editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

describe("Sidebar", () => {
  it("renders a fixed findings sidebar with real findings", () => {
    const { container } = render(<App />)

    expect(screen.getByRole("heading", { name: "Findings" })).toBeInTheDocument()
    expect(screen.queryByText("Dummy data for sidebar layout.")).not.toBeInTheDocument()
    expect(screen.getByText("[ERROR] MAX_CPS (line 1)")).toBeInTheDocument()
    expect(
      screen.getByText("[WARN] MIN_CPS (line 4)")
    ).toBeInTheDocument()

    const root = container.firstElementChild
    expect(root).toHaveStyle("padding-right: 320px")
  })
})
