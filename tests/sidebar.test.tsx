// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { useEffect, useMemo } from "react"

import App from "../src/App"

const cmSpies = vi.hoisted(() => ({
  dispatch: vi.fn(),
  focus: vi.fn(),
}))

vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
    onCreateEditor,
  }: {
    value: string
    onChange: (value: string) => void
    onCreateEditor?: (view: unknown) => void
  }) => {
    const view = useMemo(() => {
      const lines = value.split("\n")
      const starts: number[] = []
      let offset = 0
      for (const line of lines) {
        starts.push(offset)
        offset += line.length + 1
      }

      return {
        state: {
          doc: {
            lines: lines.length,
            line: (n: number) => {
              const i = n - 1
              const text = lines[i] ?? ""
              const from = starts[i] ?? 0
              return { from, to: from + text.length, text }
            },
          },
        },
        dispatch: cmSpies.dispatch,
        focus: cmSpies.focus,
      }
    }, [value])

    useEffect(() => {
      onCreateEditor?.(view)
    }, [onCreateEditor, view])

    return (
      <textarea
        aria-label="Code editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  },
}))

describe("Sidebar", () => {
  beforeEach(() => {
    cmSpies.dispatch.mockReset()
    cmSpies.focus.mockReset()
  })

  it("renders a fixed findings sidebar with real findings", () => {
    const { container } = render(<App />)

    expect(screen.getByRole("heading", { name: "Findings" })).toBeInTheDocument()
    expect(screen.queryByText("Dummy data for sidebar layout.")).not.toBeInTheDocument()
    expect(screen.getAllByText("MAX_CPS (line 1)").length).toBeGreaterThan(0)
    expect(screen.getAllByText("MIN_CPS (line 4)").length).toBeGreaterThan(0)
    const errorIcon = container.querySelector(".la-times-circle")
    const warningIcon = container.querySelector(".la-exclamation-triangle")
    expect(errorIcon).not.toBeNull()
    expect(warningIcon).not.toBeNull()
    expect(errorIcon).toHaveStyle("color: var(--danger)")
    expect(warningIcon).toHaveStyle("color: var(--warning)")

    const root = container.firstElementChild
    expect(root).toHaveStyle("padding-right: 320px")
  })

  it("jumps editor selection when clicking a finding", () => {
    render(<App />)
    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement
    const firstLineLength = editor.value.split("\n")[0]?.length ?? 0

    fireEvent.click(screen.getAllByRole("button", { name: "MAX_CPS (line 1)" })[0])

    expect(cmSpies.dispatch).toHaveBeenCalledWith({
      selection: { anchor: firstLineLength + 1 },
      scrollIntoView: true,
    })
    expect(cmSpies.focus).toHaveBeenCalledTimes(1)
  })
})
