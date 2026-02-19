// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { useEffect, useMemo } from "react"

import App from "../src/App"

const cmSpies = vi.hoisted(() => ({
  dispatch: vi.fn(),
  focus: vi.fn(),
}))

const gutterSpies = vi.hoisted(() => ({
  timestampLinkGutter: vi.fn(() => ({ __mockTimestampLinkGutter: true })),
}))

vi.mock("../src/cm/timestampLinkGutter", () => ({
  timestampLinkGutter: gutterSpies.timestampLinkGutter,
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
        contentDOM: {
          focus: vi.fn(),
        },
        scrollDOM: {
          scrollTop: 0,
          scrollHeight: 2000,
          clientHeight: 200,
          parentElement: null,
          ownerDocument: {
            scrollingElement: null,
          },
        },
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
    gutterSpies.timestampLinkGutter.mockClear()
  })

  it("renders a fixed findings sidebar with real findings", () => {
    const { container } = render(<App />)

    expect(screen.getByRole("heading", { name: "Findings" })).toBeInTheDocument()
    expect(screen.queryByText("Dummy data for sidebar layout.")).not.toBeInTheDocument()
    expect(screen.getAllByText("MAX_CPS").length).toBeGreaterThan(0)
    expect(screen.getAllByText("MIN_CPS").length).toBeGreaterThan(0)
    const errorIcon = container.querySelector(".la-times-circle")
    const warningIcon = container.querySelector(".la-exclamation-triangle")
    expect(errorIcon).not.toBeNull()
    expect(warningIcon).not.toBeNull()
    expect(errorIcon).toHaveStyle("color: var(--danger)")
    expect(warningIcon).toHaveStyle("color: var(--warning)")

    const root = container.firstElementChild
    expect(root).toHaveStyle("padding-right: 320px")
    expect(container.querySelectorAll(".finding-row-button.is-active").length).toBeGreaterThan(0)
  })

  it("jumps editor selection when clicking a finding", () => {
    render(<App />)
    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement
    const firstLineLength = editor.value.split("\n")[0]?.length ?? 0

    fireEvent.click(screen.getAllByText("MAX_CPS")[0])

    expect(cmSpies.dispatch).toHaveBeenCalledWith({
      selection: { anchor: firstLineLength + 1 },
      scrollIntoView: true,
    })
    expect(cmSpies.focus).not.toHaveBeenCalled()
  })

  it("can hide warning findings through includeWarnings prop", () => {
    const { container } = render(<App includeWarnings={false} />)
    expect(container.querySelector(".la-exclamation-triangle")).toBeNull()
    expect(within(container).queryAllByText("MIN_CPS")).toHaveLength(0)
  })

  it("keeps gutter indicators and disables colorization by default", () => {
    render(<App />)
    expect(gutterSpies.timestampLinkGutter).toHaveBeenCalled()
    expect(gutterSpies.timestampLinkGutter.mock.calls[0]?.[1]).toEqual({
      colorize: false,
    })
  })

  it("can colorize gutter indicators when enabled", () => {
    render(<App colorizeGutterIndicators={true} />)
    expect(gutterSpies.timestampLinkGutter).toHaveBeenCalled()
    expect(gutterSpies.timestampLinkGutter.mock.calls[0]?.[1]).toEqual({
      colorize: true,
    })
  })
})
