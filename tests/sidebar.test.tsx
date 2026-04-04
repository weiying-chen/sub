// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useEffect, useMemo } from "react"
import { EditorView } from "@codemirror/view"

import App from "../src/App"

const indexCss = readFileSync(join(process.cwd(), "src/index.css"), "utf8")

const cmSpies = vi.hoisted(() => ({
  dispatch: vi.fn(),
  focus: vi.fn(),
  lastExtensions: null as unknown[] | null,
  lastView: null as {
    scrollDOM: { scrollTop: number }
    state: { doc: { lines: number; line: (n: number) => { from: number; to: number; text: string } } }
  } | null,
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
    extensions,
  }: {
    value: string
    onChange: (value: string) => void
    onCreateEditor?: (view: unknown) => void
    extensions?: unknown[]
  }) => {
    const view = useMemo(() => {
      const lines = value.split("\n")
      const lineHeight = 20
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
        lineBlockAt: (pos: number) => {
          for (let n = 1; n <= lines.length; n += 1) {
            const i = n - 1
            const from = starts[i] ?? 0
            const to = from + (lines[i]?.length ?? 0)
            if (pos >= from && pos <= to) {
              const top = i * lineHeight
              return { top, bottom: top + lineHeight }
            }
          }
          const fallbackTop = Math.max(0, lines.length - 1) * lineHeight
          return { top: fallbackTop, bottom: fallbackTop + lineHeight }
        },
        dispatch: cmSpies.dispatch,
        focus: cmSpies.focus,
        contentDOM: {
          focus: vi.fn(),
        },
        scrollDOM: {
          scrollTop: 0,
          scrollHeight: Math.max(200, lines.length * lineHeight),
          clientHeight: 200,
          parentElement: null,
          ownerDocument: {
            scrollingElement: null,
          },
        },
      }
    }, [value])

    useEffect(() => {
      cmSpies.lastView = view
      cmSpies.lastExtensions = extensions ?? null
      onCreateEditor?.(view)
    }, [extensions, onCreateEditor, view])

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
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    window.localStorage.clear()
    cmSpies.dispatch.mockReset()
    cmSpies.focus.mockReset()
    cmSpies.lastExtensions = null
    cmSpies.lastView = null
    gutterSpies.timestampLinkGutter.mockClear()
  })

  it("renders a fixed findings sidebar with real findings", () => {
    const { container } = render(<App />)
    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement

    fireEvent.change(editor, {
      target: {
        value: [
          "00:00:01:00\t00:00:02:00\tMarker",
          "This translation is definitely too long for one second.",
          "",
          "00:00:02:00\t00:00:06:00\tMarker",
          "OK.",
        ].join("\n"),
      },
    })

    expect(screen.getByRole("heading", { name: "Findings" })).toBeInTheDocument()
    expect(screen.queryByText("Dummy data for sidebar layout.")).not.toBeInTheDocument()
    expect(screen.getAllByText("Reading speed is too high").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Reading speed is too low").length).toBeGreaterThan(0)
    const errorIcon = container.querySelector(".la-times-circle")
    const warningIcon = container.querySelector(".la-exclamation-triangle")
    expect(errorIcon).not.toBeNull()
    expect(warningIcon).not.toBeNull()
    expect(errorIcon).toHaveAttribute("data-severity", "error")
    expect(warningIcon).toHaveAttribute("data-severity", "warn")

    const root = container.firstElementChild
    expect(root).toHaveClass("app-shell")
    expect(container.querySelectorAll(".finding-row-button.is-active").length).toBeGreaterThan(0)
  })

  it("loads the provided cervical spine transcript as the default sample", () => {
    render(<App />)

    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement
    expect(editor.value).toContain("00:07:09:14\t00:07:11:23\t手麻 不舒服")
    expect(editor.value).toContain("ossification of the posterior longitudinal ligament.")
  })

  it("enables line wrapping in the editor", () => {
    render(<App />)

    expect(cmSpies.lastExtensions).toContain(EditorView.lineWrapping)
  })

  it("does not reserve a scrollbar gutter on the shared editor scroll container", () => {
    expect(indexCss).toMatch(/\.app-editor-scroll\s*\{[\s\S]*padding:\s*0;/)
    expect(indexCss).not.toMatch(/\.app-editor-scroll\s*\{[\s\S]*scrollbar-gutter:/)
  })

  it("uses a shared top inset for content padding and timestamp gutter offset", () => {
    expect(indexCss).toMatch(/:root\s*\{[\s\S]*--cm-top-inset:\s*12px;/)
    expect(indexCss).toMatch(/\.app-editor-inner\s+\.cm-gutters\s*\{[\s\S]*padding:\s*var\(--cm-top-inset\) 0 12px 12px;/)
    expect(indexCss).toMatch(/\.app-editor-inner\s+\.cm-content\s*\{[\s\S]*padding:\s*var\(--cm-top-inset\) 0;/)
    expect(indexCss).toMatch(/\.cm-ts-link-gutter\s+\.cm-gutterElement\s*\{[\s\S]*transform:\s*translateY\(calc\(-1 \* var\(--cm-top-inset\)\)\);/)
  })

  it("uses one finding active background token across sidebar and editor", () => {
    expect(indexCss).toMatch(/:root\s*\{[\s\S]*--finding-active-bg:\s*#ebf0f5;/)
    expect(indexCss).toMatch(/\[data-theme="dark"\]\s*\{[\s\S]*--finding-active-bg:\s*#202a38;/)
    expect(indexCss).toMatch(/\.cm-finding-active\s*\{[\s\S]*background:\s*var\(--finding-active-bg\);/)
    expect(indexCss).toMatch(/\.finding-row-button\.is-active\s*\{[\s\S]*background:\s*var\(--finding-active-bg\);/)
  })

  it("uses one finding active token for both hover and selected states", () => {
    expect(indexCss).not.toMatch(/--finding-hover-bg:/)
    expect(indexCss).toMatch(/\.finding-row-button:hover\s*\{[\s\S]*background:\s*var\(--finding-active-bg\);/)
    expect(indexCss).toMatch(/\.finding-row-button\.is-active\s*\{[\s\S]*background:\s*var\(--finding-active-bg\);/)
  })

  it("keeps default timestamp gutter links slightly above finding-active contrast", () => {
    expect(indexCss).toMatch(/:root\s*\{[\s\S]*--ts-link:\s*#a7bacf;/)
    expect(indexCss).toMatch(/\[data-theme="dark"\]\s*\{[\s\S]*--ts-link:\s*#31465e;/)
  })

  it("keeps cursor selection colors tuned per theme", () => {
    expect(indexCss).toMatch(/:root\s*\{[\s\S]*--cm-selection:\s*#dbe3ec;/)
    expect(indexCss).toMatch(/\[data-theme="dark"\]\s*\{[\s\S]*--cm-selection:\s*#334155;/)
  })

  it("keeps the floating theme toggle pinned to the bottom-right", () => {
    expect(indexCss).toMatch(/\.floating-theme-toggle\s*\{[\s\S]*position:\s*fixed;/)
    expect(indexCss).toMatch(/\.floating-theme-toggle\s*\{[\s\S]*right:\s*28px;/)
    expect(indexCss).toMatch(/\.floating-theme-toggle\s*\{[\s\S]*bottom:\s*12px;/)
  })

  it("uses roomier rules modal padding", () => {
    expect(indexCss).toMatch(/\.rules-modal\s*\{[\s\S]*padding:\s*20px;/)
  })

  it("hides the fill-subs panel controls", () => {
    render(<App />)

    expect(screen.queryByRole("button", { name: "Extract selection" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Fill subs" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText("Selected source text will appear here...")
    ).not.toBeInTheDocument()
  })

  it("shows a floating theme toggle with sun/moon icons", () => {
    const { container } = render(<App />)

    const toggleButton = screen.getByRole("button", { name: "Toggle theme" })
    expect(toggleButton).toBeInTheDocument()
    expect(container.querySelector(".app-toolbar-panel")).toBeNull()
    expect(toggleButton).toHaveClass("sidebar-gear-button")
    expect(toggleButton.textContent).toBe("")
    expect(toggleButton.querySelector(".la-sun")).not.toBeNull()
    expect(toggleButton.querySelector(".la-moon")).toBeNull()

    fireEvent.click(toggleButton)
    expect(toggleButton.querySelector(".la-moon")).not.toBeNull()
    expect(toggleButton.querySelector(".la-sun")).toBeNull()
  })

  it("jumps editor selection when clicking a finding", () => {
    render(<App />)
    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement

    fireEvent.change(editor, {
      target: {
        value: [
          "00:00:01:00\t00:00:02:00\tMarker",
          "This translation is definitely too long for one second.",
        ].join("\n"),
      },
    })

    const firstLineLength = editor.value.split("\n")[0]?.length ?? 0

    fireEvent.click(screen.getAllByText("Reading speed is too high")[0])

    expect(cmSpies.dispatch).toHaveBeenCalledTimes(1)
    expect(cmSpies.dispatch.mock.calls[0]?.[0]?.selection).toEqual({
      anchor: firstLineLength + 1,
    })
    expect(cmSpies.dispatch.mock.calls[0]?.[0]?.effects).toBeDefined()
    expect(cmSpies.focus).not.toHaveBeenCalled()
  })

  it("scrolls the editor down when clicking a bottom finding", () => {
    const { container } = render(<App />)
    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement

    const lines: string[] = []
    for (let i = 0; i < 30; i += 1) {
      const start = String(i).padStart(2, "0")
      const end = String(i + 1).padStart(2, "0")
      lines.push(`00:00:${start}:00\t00:00:${end}:00\tMarker`)
      lines.push(
        i === 29
          ? "This line is definitely longer than the configured maximum character count for one subtitle row."
          : "OK."
      )
    }

    fireEvent.change(editor, {
      target: {
        value: lines.join("\n"),
      },
    })

    const editorWrap = container.querySelector(".app-editor-scroll") as HTMLDivElement | null
    fireEvent.click(screen.getAllByText("Translation has too many characters").at(-1)!)

    const view = cmSpies.lastView
    const anchor = cmSpies.dispatch.mock.calls.at(-1)?.[0]?.selection?.anchor
    expect(view).not.toBeNull()
    expect(editorWrap).not.toBeNull()
    expect(typeof anchor).toBe("number")
    if (!view || !editorWrap || typeof anchor !== "number") return

    Object.defineProperty(editorWrap, "clientHeight", { value: 200, configurable: true })
    Object.defineProperty(editorWrap, "scrollHeight", {
      value: Math.max(200, lines.length * 20),
      configurable: true,
    })
    Object.defineProperty(editorWrap, "getBoundingClientRect", {
      value: () => ({ top: 0 }),
      configurable: true,
    })

    fireEvent.click(screen.getAllByText("Translation has too many characters").at(-1)!)

    const block = view.lineBlockAt(anchor)
    const expected = Math.min(
      Math.max(0, (block.top + block.bottom) / 2 - editorWrap.clientHeight / 2),
      editorWrap.scrollHeight - editorWrap.clientHeight
    )
    expect(editorWrap.scrollTop).toBe(expected)
  })

  it("centers long-document findings when there is room", () => {
    const { container } = render(<App />)
    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement

    const lines: string[] = []
    for (let i = 0; i < 40; i += 1) {
      const start = String(i).padStart(2, "0")
      const end = String(i + 1).padStart(2, "0")
      lines.push(`00:00:${start}:00\t00:00:${end}:00\tMarker`)
      lines.push(i === 25 ? "This line is definitely longer than the configured maximum character count for one subtitle row." : "OK.")
    }

    fireEvent.change(editor, {
      target: {
        value: lines.join("\n"),
      },
    })

    const editorWrap = container.querySelector(".app-editor-scroll") as HTMLDivElement | null
    fireEvent.click(screen.getAllByText("Translation has too many characters")[0])

    const view = cmSpies.lastView
    const anchor = cmSpies.dispatch.mock.calls.at(-1)?.[0]?.selection?.anchor
    expect(view).not.toBeNull()
    expect(editorWrap).not.toBeNull()
    expect(typeof anchor).toBe("number")
    if (!view || !editorWrap || typeof anchor !== "number") return

    Object.defineProperty(editorWrap, "clientHeight", { value: 200, configurable: true })
    Object.defineProperty(editorWrap, "scrollHeight", {
      value: Math.max(200, lines.length * 20),
      configurable: true,
    })
    Object.defineProperty(editorWrap, "getBoundingClientRect", {
      value: () => ({ top: 0 }),
      configurable: true,
    })

    fireEvent.click(screen.getAllByText("Translation has too many characters")[0])

    const block = view.lineBlockAt(anchor)
    const expected = Math.min(
      Math.max(0, (block.top + block.bottom) / 2 - editorWrap.clientHeight / 2),
      editorWrap.scrollHeight - editorWrap.clientHeight
    )
    expect(editorWrap.scrollTop).toBe(expected)
    expect(editorWrap.scrollTop).toBeGreaterThan(0)
    expect(editorWrap.scrollTop).toBeLessThan(editorWrap.scrollHeight - editorWrap.clientHeight)
  })

  it("can hide warning findings through includeWarnings prop", () => {
    const { container } = render(<App includeWarnings={false} />)
    expect(container.querySelector(".la-exclamation-triangle")).toBeNull()
    expect(within(container).queryAllByText("Reading speed is too low")).toHaveLength(0)
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

  it("shows segment-rule findings like number style and leading whitespace", () => {
    render(<App />)
    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement

    fireEvent.change(editor, {
      target: {
        value: [
          "00:00:01:00\t00:00:02:00\tMarker",
          "This is 5 examples.",
          "",
          "00:00:02:00\t00:00:03:00\tMarker",
          "  Hello",
          "",
          "00:00:03:00\t00:00:04:00\tMarker",
          "This should be capitalized.",
        ].join("\n"),
      },
    })

    expect(screen.getAllByText("Number format is incorrect").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Translation starts with extra spaces").length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByText("Translation starts with extra spaces")[0])

    const activeRow = screen
      .getAllByText("Translation starts with extra spaces")[0]
      ?.closest(".finding-row-button")
    expect(activeRow).not.toBeNull()
    if (!activeRow) return
    const activeInstruction = activeRow.querySelector(".finding-row-instruction")
    expect(activeInstruction).not.toBeNull()
    expect(activeInstruction).toHaveClass("is-open")
    expect(activeInstruction).toHaveAttribute("aria-hidden", "false")
    expect(activeRow.textContent?.toLowerCase()).toContain(
      "remove leading spaces at the start of this translation"
    )

    const numberRow = screen
      .getAllByText("Number format is incorrect")[0]
      ?.closest(".finding-row-button")
    expect(numberRow).not.toBeNull()
    if (!numberRow) return
    const inactiveInstruction = numberRow.querySelector(".finding-row-instruction")
    expect(inactiveInstruction).not.toBeNull()
    expect(inactiveInstruction).not.toHaveClass("is-open")
    expect(inactiveInstruction).toHaveAttribute("aria-hidden", "true")
  })

  it("orders errors before warnings in the findings list", () => {
    const { container } = render(<App />)
    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement

    fireEvent.change(editor, {
      target: {
        value: [
          "00:00:01:00\t00:00:02:00\tMarker",
          "This translation is definitely too long for one second.",
        ].join("\n"),
      },
    })

    const findingButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".finding-row-button")
    )
    const firstFindingText = findingButtons[0]?.textContent ?? ""
    expect(["Reading speed is too high", "Translation has too many characters"].some((label) => firstFindingText.includes(label))).toBe(true)
  })

  it("shows actual CPS and character count in finding explanations", () => {
    render(<App />)
    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement

    fireEvent.change(editor, {
      target: {
        value: [
          "00:00:01:00\t00:00:02:00\tMarker",
          "This translation is definitely too long for one second.",
          "",
          "00:00:02:00\t00:00:06:00\tMarker",
          "This line is definitely longer than the configured maximum character count for one subtitle row.",
          "",
          "00:00:06:00\t00:00:08:00\tMarker",
          "OK.",
        ].join("\n"),
      },
    })

    fireEvent.click(screen.getAllByText("Reading speed is too high")[0])
    const maxCpsRow = screen
      .getAllByText("Reading speed is too high")[0]
      ?.closest(".finding-row-button")
    expect(maxCpsRow?.textContent).toContain("Current: 55.0 CPS.")

    fireEvent.click(screen.getAllByText("Reading speed is too low")[0])
    const minCpsRow = screen
      .getAllByText("Reading speed is too low")[0]
      ?.closest(".finding-row-button")
    expect(minCpsRow?.textContent).toContain("Current: 1.5 CPS.")

    fireEvent.click(screen.getAllByText("Translation has too many characters")[0])
    const maxCharsRow = screen
      .getAllByText("Translation has too many characters")[0]
      ?.closest(".finding-row-button")
    expect(maxCharsRow?.textContent).toContain("Current: 55 characters.")
  })

  it("opens and closes a rules modal from the findings gear button", async () => {
    const { container } = render(<App />)
    const ui = within(container)

    expect(ui.queryByRole("dialog", { name: "Rules" })).not.toBeInTheDocument()

    fireEvent.click(ui.getByRole("button", { name: "Open rules modal" }))

    expect(ui.getByRole("dialog", { name: "Rules" })).toBeInTheDocument()
    expect(ui.queryByRole("button", { name: "All" })).not.toBeInTheDocument()
    expect(ui.queryByRole("button", { name: "None" })).not.toBeInTheDocument()
    expect(ui.queryByRole("button", { name: "Defaults" })).not.toBeInTheDocument()
    expect(
      ui.getByRole("checkbox", { name: /Reading speed is too high/i })
    ).toBeInTheDocument()

    fireEvent.click(ui.getByRole("button", { name: "Close rules modal" }))

    await waitFor(() => {
      expect(ui.queryByRole("dialog", { name: "Rules" })).not.toBeInTheDocument()
    })
  })

  it("does not show the baseline toggle in the rules modal", () => {
    const { container } = render(<App />)
    const ui = within(container)

    fireEvent.click(ui.getByRole("button", { name: "Open rules modal" }))

    expect(
      ui.queryByRole("checkbox", { name: /Text does not match baseline/i })
    ).not.toBeInTheDocument()
    expect(
      ui.queryByRole("checkbox", { name: /Reading speed changes too much/i })
    ).not.toBeInTheDocument()
  })

  it("filters findings when a rule is unchecked in the modal", async () => {
    const { container } = render(<App />)
    const ui = within(container)
    const editor = screen.getAllByLabelText("Code editor")[0] as HTMLTextAreaElement
    const countFindingRowsWithText = (text: string) =>
      Array.from(container.querySelectorAll(".finding-row-button")).filter((el) =>
        el.textContent?.includes(text)
      ).length

    fireEvent.change(editor, {
      target: {
        value: [
          "00:00:01:00\t00:00:02:00\tMarker",
          "This translation is definitely too long for one second.",
          "",
          "00:00:02:00\t00:00:03:00\tMarker",
          "OK.",
        ].join("\n"),
      },
    })

    expect(countFindingRowsWithText("Reading speed is too high")).toBeGreaterThan(0)

    fireEvent.click(ui.getByRole("button", { name: "Open rules modal" }))
    fireEvent.click(ui.getByRole("checkbox", { name: /Reading speed is too high/i }))

    await waitFor(() => {
      expect(countFindingRowsWithText("Reading speed is too high")).toBe(0)
    })
  })
})
