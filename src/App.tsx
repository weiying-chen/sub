import { useEffect, useMemo, useState, useCallback } from "react"
import CodeMirror from "@uiw/react-codemirror"
import type { EditorView } from "@codemirror/view"
import { keymap } from "@codemirror/view"
import { Prec } from "@codemirror/state"
import { insertTab } from "@codemirror/commands"

import { analyzeLines } from "./analysis/analyzeLines"
import { defaultRules } from "./analysis/defaultRules"
import type { Metric, Finding } from "./analysis/types"

import { getFindings } from "./shared/findings"

import { findingsDecorations } from "./cm/findingsDecorations"
import { timestampLinkGutter } from "./cm/timestampLinkGutter"
import { cmTheme } from "./cm/theme"
import { getSelectedInlineText } from "./cm/selection"
import { selectLineOnTripleClick } from "./cm/selectLineOnTripleClick"
import { fillSelectedTimestampSubs } from "./cm/fillSubs"

import { sampleSubtitles } from "./fixtures/subtitles"

const FINDINGS_SIDEBAR_WIDTH = 320

function getFindingParts(finding: Finding): {
  severityIconClass: string
  severityColor: string
  detail: string
} {
  const severity =
    "severity" in finding && finding.severity ? finding.severity : "warn"
  const severityIconClass =
    severity === "error" ? "las la-times-circle" : "las la-exclamation-triangle"
  const severityColor = severity === "error" ? "var(--danger)" : "var(--warning)"
  const line = finding.lineIndex + 1
  const detail = `${finding.type} (line ${line})`
  return { severityIconClass, severityColor, detail }
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const [value, setValue] = useState(sampleSubtitles)
  const [view, setView] = useState<EditorView | null>(null)
  const [extracted, setExtracted] = useState("")

  const metrics = useMemo<Metric[]>(() => {
    return analyzeLines(value, defaultRules())
  }, [value])

  const findings = useMemo<Finding[]>(() => {
    return getFindings(metrics)
  }, [metrics])

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
      timestampLinkGutter(findings),
      findingsDecorations(findings),
    ]
  }, [findings])

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

  useEffect(() => {
    console.log("METRICS CHECKS:", metrics)

    const cpsMetrics = metrics.filter(
      (m): m is Extract<Metric, { type: "CPS" }> => m.type === "CPS"
    )

    console.log("CPS CHECKS:", cpsMetrics)
  }, [metrics])

  useEffect(() => {
    console.log("FINDINGS CHECKS:", findings)
  }, [findings])

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
          background: "var(--panel)",
          padding: 12,
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 10, fontSize: 14 }}>Findings</h3>
        {findings.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>No findings.</div>
        ) : (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 8,
              fontSize: 13,
            }}
          >
            {findings.map((finding, index) => {
              const { severityIconClass, severityColor, detail } = getFindingParts(finding)
              return (
                <li
                  key={`${finding.type}-${finding.lineIndex}-${index}`}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <i
                    className={severityIconClass}
                    aria-hidden="true"
                    style={{ color: severityColor }}
                  />
                  <span>{detail}</span>
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
