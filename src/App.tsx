import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { EditorView, keymap } from "@codemirror/view"
import { Prec } from "@codemirror/state"
import { insertTab } from "@codemirror/commands"

import { analyzeTextByType } from "./analysis/analyzeTextByType"
import { createSubsSegmentRules } from "./analysis/subsSegmentRules"
import type { Metric, Finding } from "./analysis/types"

import { getFindings } from "./shared/findings"
import { sortFindingsWithIndex } from "./shared/findingsSort"

import { findingsDecorations } from "./cm/findingsDecorations"
import { timestampLinkGutter } from "./cm/timestampLinkGutter"
import { cmTheme } from "./cm/theme"
import { getSelectedInlineText } from "./cm/selection"
import { selectLineOnTripleClick } from "./cm/selectLineOnTripleClick"
import { fillSelectedTimestampSubs } from "./cm/fillSubs"
import { mergeForward, parseBlockAt, type LineSource } from "./shared/tsvRuns"

import { sampleSubtitles } from "./fixtures/subtitles"
import capitalizationTermsText from "../capitalization-terms.txt?raw"
import properNounsText from "../punctuation-proper-nouns.txt?raw"

const FINDINGS_SIDEBAR_WIDTH = 320

function parseTextList(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
}

const capitalizationTerms = parseTextList(capitalizationTermsText)
const properNouns = parseTextList(properNounsText)

type ScrollSnapshot = {
  el: HTMLElement
  top: number
}

function getFindingId(finding: Finding, index: number): string {
  return `${finding.type}-${finding.lineIndex}-${index}`
}

type FindingRange = {
  id: string
  from: number
  to: number
}

function getFindingRanges(view: EditorView, findings: Finding[]): FindingRange[] {
  const ranges: FindingRange[] = []
  const doc = view.state.doc
  const src: LineSource = {
    lineCount: doc.lines,
    getLine: (i) => doc.line(i + 1).text,
  }

  const addRange = (id: string, from: number, to: number) => {
    if (from >= to) return
    ranges.push({ id, from, to })
  }

  const addWholeLine = (id: string, lineIndex: number) => {
    if (lineIndex < 0 || lineIndex >= doc.lines) return
    const line = doc.line(lineIndex + 1)
    addRange(id, line.from, line.to)
  }

  for (const { finding: f, index } of sortFindingsWithIndex(findings)) {
    const id = getFindingId(f, index)
    if (f.lineIndex < 0 || f.lineIndex >= doc.lines) continue

    if (f.type === "MAX_CHARS") {
      const line = doc.line(f.lineIndex + 1)
      const from = Math.min(line.to, line.from + f.maxAllowed)
      addRange(id, from, line.to)
      continue
    }

    if (f.type === "MAX_CPS" || f.type === "MIN_CPS" || f.type === "CPS_BALANCE") {
      const first = parseBlockAt(src, f.lineIndex)
      if (first) {
        const run = mergeForward(src, first)
        for (let i = run.payloadIndexStart; i <= run.payloadIndexEnd; i += 1) {
          addWholeLine(id, i)
        }
      } else {
        addWholeLine(id, f.lineIndex)
      }
      continue
    }

    if (
      f.type === "NUMBER_STYLE" ||
      f.type === "PERCENT_STYLE" ||
      f.type === "CAPITALIZATION"
    ) {
      const line = doc.line(f.lineIndex + 1)
      const tokenLength = f.token.length
      const from = Math.min(line.to, line.from + f.index)
      const to = Math.min(line.to, from + Math.max(tokenLength, 1))
      addRange(id, from, to)
      continue
    }

    if (f.type === "LEADING_WHITESPACE") {
      const line = doc.line(f.lineIndex + 1)
      const from = Math.min(line.to, line.from + f.index)
      const to = Math.min(line.to, from + Math.max(f.count, 1))
      addRange(id, from, to)
      continue
    }

    addWholeLine(id, f.lineIndex)
  }

  return ranges
}

function findFindingIdAtPos(
  view: EditorView,
  findings: Finding[],
  pos: number
): string | null {
  const hit = getFindingRanges(view, findings)
    .filter((r) => pos >= r.from && pos < r.to)
    .sort((a, b) => a.to - a.from - (b.to - b.from))[0]
  return hit?.id ?? null
}

function getFindingParts(finding: Finding): {
  severityIconClass: string
  severityColor: string
  snippet: string | null
  detail: string
} {
  const severity =
    "severity" in finding && finding.severity ? finding.severity : "warn"
  const severityIconClass =
    severity === "error" ? "las la-times-circle" : "las la-exclamation-triangle"
  const severityColor = severity === "error" ? "var(--danger)" : "var(--warning)"

  let snippet: string | null = null
  if ("token" in finding && typeof finding.token === "string" && finding.token.trim()) {
    snippet = finding.token.trim()
  } else if ("text" in finding && typeof finding.text === "string" && finding.text.trim()) {
    snippet = finding.text.trim()
  } else if ("message" in finding && typeof finding.message === "string" && finding.message.trim()) {
    snippet = finding.message.trim()
  }

  if (snippet && snippet.length > 72) {
    snippet = `${snippet.slice(0, 72)}...`
  }

  const detail = finding.type
  return { severityIconClass, severityColor, snippet, detail }
}

function getFindingAnchor(view: EditorView, finding: Finding): number {
  const doc = view.state.doc
  const safeLineIndex = Math.min(Math.max(finding.lineIndex, 0), doc.lines - 1)
  const line = doc.line(safeLineIndex + 1)

  if (
    finding.type === "MAX_CPS" ||
    finding.type === "MIN_CPS" ||
    finding.type === "CPS_BALANCE"
  ) {
    const src: LineSource = {
      lineCount: doc.lines,
      getLine: (i) => doc.line(i + 1).text,
    }
    const block = parseBlockAt(src, safeLineIndex)
    if (block) {
      const run = mergeForward(src, block)
      return doc.line(run.payloadIndexStart + 1).from
    }
    return line.from
  }

  if (finding.type === "MAX_CHARS") {
    return Math.min(line.to, line.from + finding.maxAllowed)
  }

  if (
    finding.type === "NUMBER_STYLE" ||
    finding.type === "PERCENT_STYLE" ||
    finding.type === "CAPITALIZATION" ||
    finding.type === "LEADING_WHITESPACE"
  ) {
    return Math.min(line.to, line.from + finding.index)
  }

  return line.from
}

function collectScrollContainers(view: EditorView): ScrollSnapshot[] {
  const snapshots: ScrollSnapshot[] = []
  const seen = new Set<HTMLElement>()
  let cur: HTMLElement | null = view.scrollDOM
  while (cur) {
    if (!seen.has(cur) && cur.scrollHeight > cur.clientHeight + 1) {
      seen.add(cur)
      snapshots.push({ el: cur, top: cur.scrollTop })
    }
    cur = cur.parentElement
  }

  const docScroller = view.scrollDOM.ownerDocument?.scrollingElement
  if (
    docScroller instanceof HTMLElement &&
    !seen.has(docScroller) &&
    docScroller.scrollHeight > docScroller.clientHeight + 1
  ) {
    snapshots.push({ el: docScroller, top: docScroller.scrollTop })
  }

  return snapshots
}

function focusEditorContent(view: EditorView) {
  const content = view.contentDOM as HTMLElement | null
  if (!content || typeof content.focus !== "function") return
  try {
    content.focus({ preventScroll: true })
  } catch {
    content.focus()
  }
}

type AppProps = {
  includeWarnings?: boolean
  colorizeGutterIndicators?: boolean
}

export default function App({
  includeWarnings = true,
  colorizeGutterIndicators = false,
}: AppProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const [value, setValue] = useState(sampleSubtitles)
  const [view, setView] = useState<EditorView | null>(null)
  const [extracted, setExtracted] = useState("")
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null)
  const scrollAnimFrameRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (scrollAnimFrameRef.current !== null) {
        cancelAnimationFrame(scrollAnimFrameRef.current)
      }
    }
  }, [])

  const metrics = useMemo<Metric[]>(() => {
    return analyzeTextByType(
      value,
      "subs",
      createSubsSegmentRules({
        capitalizationTerms,
        properNouns,
      })
    )
  }, [value])

  const findings = useMemo<Finding[]>(() => {
    return getFindings(metrics, { includeWarnings })
  }, [metrics, includeWarnings])
  const sortedFindings = useMemo(() => sortFindingsWithIndex(findings), [findings])

  useEffect(() => {
    if (sortedFindings.length === 0) {
      if (activeFindingId !== null) setActiveFindingId(null)
      return
    }

    const hasActive =
      activeFindingId !== null &&
      sortedFindings.some(
        ({ finding, index }) => getFindingId(finding, index) === activeFindingId
      )

    if (!hasActive) {
      setActiveFindingId(
        getFindingId(sortedFindings[0].finding, sortedFindings[0].index)
      )
    }
  }, [sortedFindings, activeFindingId])

  const extensions = useMemo(() => {
    return [
      cmTheme,

      // Hard override: Tab ALWAYS inserts a tab character.
      Prec.highest(
        keymap.of([
          { key: "Tab", run: insertTab, preventDefault: true },
          { key: "Shift-Tab", run: insertTab, preventDefault: true },
        ])
      ),

      selectLineOnTripleClick,
      timestampLinkGutter(findings, { colorize: colorizeGutterIndicators }),
      findingsDecorations(findings, activeFindingId),
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet) return
        const pos = update.state.selection.main.head
        const hitId = findFindingIdAtPos(update.view, findings, pos)
        if (hitId && hitId !== activeFindingId) {
          setActiveFindingId(hitId)
        }
      }),
    ]
  }, [findings, activeFindingId, colorizeGutterIndicators])

  const handleExtract = useCallback(() => {
    if (!view) return
    setExtracted(getSelectedInlineText(view))
  }, [view])

  const handleFillSubs = useCallback(() => {
    if (!view) return
    const { remaining } = fillSelectedTimestampSubs(view, extracted)
    setExtracted(remaining)
  }, [view, extracted])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(extracted)
    } catch {
      // ignore
    }
  }, [extracted])

  const handleToggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"))
  }, [])

  const handleFindingClick = useCallback(
    (finding: Finding, findingId: string) => {
      if (!view) return
      setActiveFindingId(findingId)
      const anchor = getFindingAnchor(view, finding)
      const snapshots = collectScrollContainers(view)

      view.dispatch({
        selection: { anchor },
        scrollIntoView: true,
      })

      if (scrollAnimFrameRef.current !== null) {
        cancelAnimationFrame(scrollAnimFrameRef.current)
      }

      scrollAnimFrameRef.current = requestAnimationFrame(() => {
        const moved = snapshots
          .map(({ el, top }) => ({ el, startTop: top, targetTop: el.scrollTop }))
          .filter(({ startTop, targetTop }) => Math.abs(targetTop - startTop) > 0.5)

        if (moved.length === 0) {
          focusEditorContent(view)
          scrollAnimFrameRef.current = null
          return
        }

        const primary = moved.reduce((best, cur) =>
          Math.abs(cur.targetTop - cur.startTop) > Math.abs(best.targetTop - best.startTop)
            ? cur
            : best
        )

        const { el, startTop, targetTop } = primary
        const delta = targetTop - startTop
        if (Math.abs(delta) < 1) {
          focusEditorContent(view)
          scrollAnimFrameRef.current = null
          return
        }

        el.scrollTop = startTop
        const durationMs = 420
        const start = performance.now()
        const easeInOutCubic = (t: number) =>
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

        const step = (now: number) => {
          const elapsed = now - start
          const t = Math.min(1, elapsed / durationMs)
          el.scrollTop = startTop + delta * easeInOutCubic(t)
          if (t < 1) {
            scrollAnimFrameRef.current = requestAnimationFrame(step)
          } else {
            scrollAnimFrameRef.current = null
            focusEditorContent(view)
          }
        }

        scrollAnimFrameRef.current = requestAnimationFrame(step)
      })
    },
    [view]
  )

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        paddingRight: FINDINGS_SIDEBAR_WIDTH,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <CodeMirror
          value={value}
          onChange={setValue}
          height="100%"
          width="100%"
          basicSetup={{
            lineNumbers: false,
            drawSelection: true,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            highlightSelectionMatches: false,
          }}
          extensions={extensions}
          onCreateEditor={(v) => setView(v)}
        />
      </div>

      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: FINDINGS_SIDEBAR_WIDTH,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg)",
          padding: 12,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 10, fontSize: 14 }}>Findings</h3>
        {findings.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>No findings.</div>
        ) : (
          <ul
            style={{
              margin: 0,
              marginLeft: -12,
              marginRight: -12,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              fontSize: 13,
            }}
          >
            {sortedFindings.map(({ finding, index }) => {
              const { severityIconClass, severityColor, snippet, detail } = getFindingParts(finding)
              const findingId = getFindingId(finding, index)
              return (
                <li
                  key={findingId}
                  style={{ display: "flex", alignItems: "flex-start" }}
                >
                  <button
                    type="button"
                    onClick={() => handleFindingClick(finding, findingId)}
                    className={`finding-row-button${activeFindingId === findingId ? " is-active" : ""}`}
                    style={{
                      width: "100%",
                      display: "block",
                      textAlign: "left",
                      border: "none",
                      padding: "6px 12px",
                      color: "inherit",
                      font: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <i
                        className={severityIconClass}
                        aria-hidden="true"
                        style={{ color: severityColor, marginTop: 2 }}
                      />
                      <span
                        style={{
                          color: "var(--muted)",
                          fontSize: 12,
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        {detail}
                      </span>
                    </span>
                    {snippet ? (
                      <span
                        style={{
                          display: "block",
                          marginTop: 2,
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        {snippet}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--panel)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleExtract} disabled={!view}>
            Extract selection
          </button>
          <button onClick={handleFillSubs} disabled={!view || !extracted.trim()}>
            Fill subs
          </button>
          <button onClick={handleCopy} disabled={!extracted}>
            Copy
          </button>

          <button onClick={handleToggleTheme} style={{ marginLeft: "auto" }}>
            Theme: {theme}
          </button>
        </div>

        <textarea
          value={extracted}
          onChange={(e) => setExtracted(e.target.value)}
          placeholder="Selected inline subtitle text will appear here..."
          style={{
            width: "100%",
            height: 120,
            resize: "none",
            background: "var(--bg)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        />
      </div>
    </div>
  )
}
