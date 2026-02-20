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
import { getFindingLabel } from "./shared/findingLabels"

import { findingsDecorations } from "./cm/findingsDecorations"
import {
  resolveFindingIdAtPos,
  resolvePreferredFindingId,
  type FindingRange,
} from "./cm/findingSelection"
import { timestampLinkGutter } from "./cm/timestampLinkGutter"
import { cmTheme } from "./cm/theme"
import { getSelectedInlineText } from "./cm/selection"
import { selectLineOnTripleClick } from "./cm/selectLineOnTripleClick"
import { fillSelectedTimestampSubs } from "./cm/fillSubs"
import { mergeForward, mergedRunPayloadIndices, parseBlockAt, type LineSource } from "./shared/tsvRuns"

import { sampleSubtitles } from "./fixtures/subtitles"
import capitalizationTermsText from "../capitalization-terms.txt?raw"
import properNounsText from "../punctuation-proper-nouns.txt?raw"

const FINDINGS_SIDEBAR_WIDTH = 320
const RULES_MODAL_ANIMATION_MS = 170
const RULE_FILTERS_STORAGE_KEY = "subs.ruleFilters.v1"

type RuleOption = {
  type: Finding["type"]
  label: string
  severity: "error" | "warn"
}

const RULE_OPTIONS: RuleOption[] = [
  { type: "MAX_CPS", label: "Reading speed is too high", severity: "error" },
  { type: "MAX_CHARS", label: "Line has too many characters", severity: "error" },
  { type: "NUMBER_STYLE", label: "Number format is incorrect", severity: "error" },
  { type: "PERCENT_STYLE", label: "Percent format is incorrect", severity: "error" },
  { type: "CAPITALIZATION", label: "Capitalization is incorrect", severity: "error" },
  { type: "LEADING_WHITESPACE", label: "Line starts with extra spaces", severity: "error" },
  { type: "PUNCTUATION", label: "Punctuation is incorrect", severity: "error" },
  { type: "BASELINE", label: "Text does not match baseline", severity: "error" },
  { type: "CPS_BALANCE", label: "Reading speed changes too much", severity: "warn" },
  { type: "MIN_CPS", label: "Reading speed is too low", severity: "warn" },
  { type: "MERGE_CANDIDATE", label: "Lines could be merged", severity: "warn" },
]

const DEFAULT_ENABLED_RULE_TYPES = RULE_OPTIONS.map((rule) => rule.type)
const WARNING_RULE_TYPES = RULE_OPTIONS.filter((rule) => rule.severity === "warn").map(
  (rule) => rule.type
)

function loadEnabledRuleTypes(): Set<Finding["type"]> {
  const fallback = new Set<Finding["type"]>(DEFAULT_ENABLED_RULE_TYPES)
  if (typeof window === "undefined") return fallback

  try {
    const raw = window.localStorage.getItem(RULE_FILTERS_STORAGE_KEY)
    if (!raw) return fallback

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return fallback

    const allowed = new Set(DEFAULT_ENABLED_RULE_TYPES)
    const selected = parsed.filter(
      (entry): entry is Finding["type"] =>
        typeof entry === "string" && allowed.has(entry as Finding["type"])
    )
    if (selected.length === 0) return fallback
    return new Set(selected)
  } catch {
    return fallback
  }
}

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

function findingTsLineIndex(finding: Finding): number {
  if (
    (finding.type === "MAX_CPS" ||
      finding.type === "MIN_CPS" ||
      finding.type === "CPS_BALANCE") &&
    typeof finding.tsLineIndex === "number"
  ) {
    return finding.tsLineIndex
  }
  return finding.lineIndex
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
      const first = parseBlockAt(src, findingTsLineIndex(f))
      if (first) {
        const payloadIndices = mergedRunPayloadIndices(src, first)
        for (const i of payloadIndices) {
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

    if (f.type === "MERGE_CANDIDATE") {
      addWholeLine(id, f.lineIndex)
      addWholeLine(id, f.nextLineIndex)
      continue
    }

    addWholeLine(id, f.lineIndex)
  }

  return ranges
}

function findFindingIdAtPos(
  view: EditorView,
  findings: Finding[],
  pos: number,
  preferredId: string | null
): string | null {
  return resolveFindingIdAtPos(getFindingRanges(view, findings), pos, preferredId)
}

function getFindingParts(finding: Finding): {
  severityIconClass: string
  severityColor: string
  snippet: string | null
  detail: string
  explanation: string | null
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
  }

  if (snippet && snippet.length > 72) {
    snippet = `${snippet.slice(0, 72)}...`
  }

  const detail = getFindingLabel(finding)
  const explanation =
    typeof finding.instruction === "string" && finding.instruction.trim() !== ""
      ? finding.instruction
      : null
  return { severityIconClass, severityColor, snippet, detail, explanation }
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
    const tsLineIndex = Math.min(
      Math.max(findingTsLineIndex(finding), 0),
      doc.lines - 1
    )
    const block = parseBlockAt(src, tsLineIndex)
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
  const [enabledRuleTypes, setEnabledRuleTypes] = useState<Set<Finding["type"]>>(
    () => loadEnabledRuleTypes()
  )
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false)
  const [isRulesModalMounted, setIsRulesModalMounted] = useState(false)
  const scrollAnimFrameRef = useRef<number | null>(null)
  const pendingClickFindingIdRef = useRef<string | null>(null)
  const rulesModalCloseTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (scrollAnimFrameRef.current !== null) {
        cancelAnimationFrame(scrollAnimFrameRef.current)
      }
      if (rulesModalCloseTimerRef.current !== null) {
        clearTimeout(rulesModalCloseTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      RULE_FILTERS_STORAGE_KEY,
      JSON.stringify(Array.from(enabledRuleTypes))
    )
  }, [enabledRuleTypes])

  const openRulesModal = useCallback(() => {
    if (rulesModalCloseTimerRef.current !== null) {
      clearTimeout(rulesModalCloseTimerRef.current)
      rulesModalCloseTimerRef.current = null
    }
    setIsRulesModalMounted(true)
    requestAnimationFrame(() => {
      setIsRulesModalOpen(true)
    })
  }, [])

  const closeRulesModal = useCallback(() => {
    setIsRulesModalOpen(false)
    if (rulesModalCloseTimerRef.current !== null) {
      clearTimeout(rulesModalCloseTimerRef.current)
    }
    rulesModalCloseTimerRef.current = window.setTimeout(() => {
      setIsRulesModalMounted(false)
      rulesModalCloseTimerRef.current = null
    }, RULES_MODAL_ANIMATION_MS)
  }, [])

  const setAllRulesEnabled = useCallback(() => {
    setEnabledRuleTypes(new Set(DEFAULT_ENABLED_RULE_TYPES))
  }, [])

  const setNoRulesEnabled = useCallback(() => {
    setEnabledRuleTypes(new Set())
  }, [])

  const setDefaultRulesEnabled = useCallback(() => {
    setEnabledRuleTypes(new Set(DEFAULT_ENABLED_RULE_TYPES))
  }, [])

  const toggleRule = useCallback((type: Finding["type"]) => {
    setEnabledRuleTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const metrics = useMemo<Metric[]>(() => {
    const analysisEnabledRuleTypes = includeWarnings
      ? Array.from(enabledRuleTypes)
      : Array.from(enabledRuleTypes).filter(
          (type) => !WARNING_RULE_TYPES.includes(type)
        )

    return analyzeTextByType(
      value,
      "subs",
      createSubsSegmentRules({
        capitalizationTerms,
        properNouns,
        enabledFindingTypes: analysisEnabledRuleTypes,
      })
    )
  }, [value, enabledRuleTypes, includeWarnings])

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
        const preferredId = resolvePreferredFindingId(
          activeFindingId,
          pendingClickFindingIdRef.current
        )
        const hitId = findFindingIdAtPos(update.view, findings, pos, preferredId)
        pendingClickFindingIdRef.current = null
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
      pendingClickFindingIdRef.current = findingId
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
        <div className="sidebar-header">
          <h3 style={{ margin: 0, fontSize: 14 }}>Findings</h3>
          <button
            type="button"
            className="sidebar-gear-button"
            aria-label="Open rules modal"
            onClick={openRulesModal}
          >
            <i className="las la-cog" aria-hidden="true" />
          </button>
        </div>
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
              const { severityIconClass, severityColor, snippet, detail, explanation } = getFindingParts(finding)
              const findingId = getFindingId(finding, index)
              const isActive = activeFindingId === findingId
              return (
                <li
                  key={findingId}
                  style={{ display: "flex", alignItems: "flex-start" }}
                >
                  <button
                    type="button"
                    onClick={() => handleFindingClick(finding, findingId)}
                    className={`finding-row-button${isActive ? " is-active" : ""}`}
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
                    {explanation ? (
                      <span
                        className={`finding-row-instruction${isActive ? " is-open" : ""}`}
                        aria-hidden={!isActive}
                      >
                        <span className="finding-row-instruction-text">{explanation}</span>
                      </span>
                    ) : null}
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

      {isRulesModalMounted ? (
        <div
          className={`rules-modal-overlay${isRulesModalOpen ? " is-open" : ""}`}
          onClick={closeRulesModal}
        >
          <div
            className="rules-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Rules"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rules-modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>Rules</h3>
              <button
                type="button"
                className="rules-modal-close-button"
                aria-label="Close rules modal"
                onClick={closeRulesModal}
              >
                <i className="las la-times" aria-hidden="true" />
              </button>
            </div>
            <div className="rules-modal-actions">
              <button type="button" onClick={setAllRulesEnabled}>
                All
              </button>
              <button type="button" onClick={setNoRulesEnabled}>
                None
              </button>
              <button type="button" onClick={setDefaultRulesEnabled}>
                Defaults
              </button>
            </div>
            <div className="rules-modal-groups">
              <div className="rules-modal-group">
                <div className="rules-modal-group-title">Errors</div>
                {RULE_OPTIONS.filter((rule) => rule.severity === "error").map((rule) => (
                  <label key={rule.type} className="rules-modal-checkbox">
                    <input
                      type="checkbox"
                      checked={enabledRuleTypes.has(rule.type)}
                      onChange={() => toggleRule(rule.type)}
                    />
                    <span>{rule.label}</span>
                  </label>
                ))}
              </div>
              <div className="rules-modal-group">
                <div className="rules-modal-group-title">Warnings</div>
                {RULE_OPTIONS.filter((rule) => rule.severity === "warn").map((rule) => (
                  <label key={rule.type} className="rules-modal-checkbox">
                    <input
                      type="checkbox"
                      checked={enabledRuleTypes.has(rule.type)}
                      onChange={() => toggleRule(rule.type)}
                    />
                    <span>{rule.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
