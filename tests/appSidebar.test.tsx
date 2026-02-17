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

describe("App findings sidebar", () => {
  it("renders a fixed findings sidebar with placeholder items", () => {
    const { container } = render(<App />)

    expect(screen.getByRole("heading", { name: "Findings" })).toBeInTheDocument()
    expect(
      screen.getByText("Dummy data for sidebar layout.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("[ERROR] Line 23: Too many characters")
    ).toBeInTheDocument()

    const root = container.firstElementChild
    expect(root).toHaveStyle("padding-right: 320px")
  })
})
