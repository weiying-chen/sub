import { useEffect, useMemo, useState, useCallback } from "react"
import CodeMirror from "@uiw/react-codemirror"
import type { EditorView } from "@codemirror/view"

import { analyzeLines } from "./analysis/analyzeLines"
import { maxCharsRule } from "./analysis/maxCharsRule"
import { cpsRule } from "./analysis/cpsRule"
import { tokenizeText } from "./analysis/tokenize"
import { findingsDecorations } from "./cm/findingsDecorations"
import { timestampLinkGutter } from "./cm/timestampLinkGutter"
import { cmTheme } from "./cm/theme"
import { getSelectedInlineText } from "./cm/selection"
import { selectLineOnTripleClick } from "./cm/selectLineOnTripleClick"
import type { Metric, Finding } from "./analysis/types"
import { sampleSubtitles } from "./fixtures/subtitles"

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const [value, setValue] = useState(sampleSubtitles)
  const [view, setView] = useState<EditorView | null>(null)
  const [extracted, setExtracted] = useState("")

  const metrics = useMemo<Metric[]>(() => {
    return analyzeLines(value, [maxCharsRule(54), cpsRule()])
  }, [value])

  const cpsMetrics = useMemo(() => {
    return metrics.filter((m) => m.type === "CPS")
  }, [metrics])

  const findings = useMemo<Finding[]>(() => {
    const out: Finding[] = []

    for (const m of metrics) {
      if (m.type === "MAX_CHARS") {
        if (m.actual > m.maxAllowed) out.push(m)
        continue
      }

      if (m.type === "CPS") {
        if (m.cps > m.maxCps) out.push(m)
        continue
      }
    }

    return out
  }, [metrics])

  const cpsFindings = useMemo(() => {
    return findings.filter((f) => f.type === "CPS")
  }, [findings])

  useEffect(() => {
    console.log("ALL metrics:", metrics)
  }, [metrics])

  useEffect(() => {
    console.log("ALL CPS metrics:", cpsMetrics)
  }, [cpsMetrics])

  useEffect(() => {
    console.log("CPS findings:", cpsFindings)
  }, [cpsFindings])

  const extensions = useMemo(() => {
    return [
      cmTheme,
      selectLineOnTripleClick,
      timestampLinkGutter(findings),
      findingsDecorations(findings),
    ]
  }, [findings])

  const handleExtract = useCallback(() => {
    if (!view) return
    setExtracted(getSelectedInlineText(view))
  }, [view])

  const handleTokenize = useCallback(() => {
    const tokens = tokenizeText(extracted)
    console.log("TOKENS:", tokens)
  }, [extracted])

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

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
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
          <button onClick={handleTokenize} disabled={!extracted.trim()}>
            Tokenize textarea
          </button>
          <button onClick={handleCopy} disabled={!extracted}>
            Copy
          </button>

          <button
            onClick={handleToggleTheme}
            style={{ marginLeft: "auto" }}
          >
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
