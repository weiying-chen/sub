import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { EditorView, keymap } from "@codemirror/view"
import { Prec } from "@codemirror/state"
import { insertTab } from "@codemirror/commands"

import { buildAnalysisOutput } from "./analysis/buildAnalysisOutput"
import type { Metric, Finding } from "./analysis/types"

import { getFindings } from "./shared/findings"
import { sortFindingsWithIndex } from "./shared/findingsSort"
import { getFindingLabel, getFindingTypeLabel } from "./shared/findingLabels"

import { findingsDecorations } from "./cm/findingsDecorations"
import {
  resolveFindingIdAtPos,
  resolvePreferredFindingId,
  type FindingRange,
} from "./cm/findingSelection"
import { timestampLinkGutter } from "./cm/timestampLinkGutter"
import { cmTheme } from "./cm/theme"
import { selectLineOnTripleClick } from "./cm/selectLineOnTripleClick"
import { mergedRunTranslationIndices, parseBlockAt, type LineSource } from "./shared/tsvRuns"

import { sampleSubtitles } from "./fixtures/subtitles"
import { RULE_MODAL_EXPLANATIONS } from "./shared/wording"
import { MAX_CPS, MIN_CPS } from "./shared/subtitles"
import capitalizationTermsText from "../capitalization-terms.txt?raw"
import punctuationAbbreviationsText from "../punctuation-abbreviations.txt?raw"
import properNounsText from "../punctuation-proper-nouns.txt?raw"

const RULES_MODAL_ANIMATION_MS = 170
const RULE_FILTERS_STORAGE_KEY = "subs.ruleFilters"
const MODE_STORAGE_KEY = "subs.analysisType"
const EDITOR_TEXT_STORAGE_KEY = "subs.editorText"
const MAX_CPS_STORAGE_KEY = "subs.maxCps"
const MIN_CPS_STORAGE_KEY = "subs.minCps"
const THEME_STORAGE_KEY = "subs.theme"
const FINDINGS_MOTION_SUPPRESS_MS = 220
type AppAnalysisType = "subs" | "text"

type RuleOption = {
  type: Finding["type"]
  label: string
  explanation: string
  severity: "error" | "warn"
}

const RULE_OPTION_SPECS: Array<{
  type: Finding["type"]
  severity: "error" | "warn"
}> = [
  { type: "BLOCK_STRUCTURE", severity: "error" },
  { type: "TIMESTAMP_FORMAT", severity: "error" },
  { type: "MAX_CPS", severity: "error" },
  { type: "MAX_CHARS", severity: "error" },
  { type: "PUNCTUATION", severity: "error" },
  { type: "NUMBER_STYLE", severity: "error" },
  { type: "PERCENT_STYLE", severity: "error" },
  { type: "DASH_STYLE", severity: "error" },
  { type: "MIN_CPS", severity: "warn" },
  { type: "SPAN_GAP", severity: "warn" },
  { type: "MERGE_CANDIDATE", severity: "warn" },
  { type: "JOINABLE_BREAK", severity: "warn" },
]

const RULE_OPTIONS: RuleOption[] = RULE_OPTION_SPECS.map((spec) => {
  const explanation = RULE_MODAL_EXPLANATIONS[spec.type]
  if (!explanation) {
    throw new Error(`Missing modal explanation for rule type: ${spec.type}`)
  }
  return {
    type: spec.type,
    label: getFindingTypeLabel(spec.type),
    explanation,
    severity: spec.severity,
  }
})

const DISPLAYED_RULE_TYPES = new Set<Finding["type"]>(RULE_OPTIONS.map((rule) => rule.type))
const ANALYSIS_TYPE_OPTIONS: Array<{ type: AppAnalysisType; label: string }> = [
  { type: "subs", label: "Subs" },
  { type: "text", label: "Text" },
]
const APPLICABLE_RULE_TYPES_BY_ANALYSIS_TYPE: Record<AppAnalysisType, Set<Finding["type"]>> = {
  subs: new Set<Finding["type"]>(RULE_OPTIONS.map((rule) => rule.type)),
  text: new Set<Finding["type"]>([
    "MAX_CHARS",
    "LEADING_WHITESPACE",
    "NUMBER_STYLE",
    "PERCENT_STYLE",
    "DASH_STYLE",
    "CAPITALIZATION",
  ]),
}
const DEFAULT_UI_ENABLED_RULE_TYPES_BY_ANALYSIS_TYPE: Record<AppAnalysisType, Finding["type"][]> = {
  subs: [
    "MAX_CHARS",
    "MERGE_CANDIDATE",
    "JOINABLE_BREAK",
    "NUMBER_STYLE",
    "PUNCTUATION",
    "MAX_CPS",
  ],
  text: ["MAX_CHARS", "NUMBER_STYLE", "DASH_STYLE", "PERCENT_STYLE"],
}
const WARNING_RULE_TYPES = RULE_OPTIONS.filter((rule) => rule.severity === "warn").map(
  (rule) => rule.type
)

function loadStoredAnalysisType(): AppAnalysisType {
  if (typeof window === "undefined") return "subs"
  try {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY)
    if (raw === "subs" || raw === "text") return raw
    return "subs"
  } catch {
    return "subs"
  }
}

function getRuleFiltersStorageKey(type: AppAnalysisType): string {
  if (type === "subs") return RULE_FILTERS_STORAGE_KEY
  return `${RULE_FILTERS_STORAGE_KEY}.${type}`
}

function loadEnabledRuleTypes(type: AppAnalysisType): Set<Finding["type"]> {
  const applicable = APPLICABLE_RULE_TYPES_BY_ANALYSIS_TYPE[type]
  const fallback = new Set<Finding["type"]>(
    DEFAULT_UI_ENABLED_RULE_TYPES_BY_ANALYSIS_TYPE[type].filter(
      (ruleType) => DISPLAYED_RULE_TYPES.has(ruleType) && applicable.has(ruleType)
    )
  )
  if (typeof window === "undefined") return fallback

  try {
    const raw = window.localStorage.getItem(getRuleFiltersStorageKey(type))
    if (!raw) return fallback

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return fallback

    const allowed = DISPLAYED_RULE_TYPES
    const selected = parsed.filter(
      (entry): entry is Finding["type"] =>
        typeof entry === "string" &&
        allowed.has(entry as Finding["type"]) &&
        applicable.has(entry as Finding["type"])
    )
    if (parsed.length > 0 && selected.length === 0) return fallback
    return new Set(selected)
  } catch {
    return fallback
  }
}

function loadStoredCpsThreshold(storageKey: string, fallback: number): number {
  if (typeof window === "undefined") return fallback

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw == null) return fallback
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return parsed
  } catch {
    return fallback
  }
}

function loadStoredEditorText(): string {
  if (typeof window === "undefined") return sampleSubtitles

  try {
    const raw = window.localStorage.getItem(EDITOR_TEXT_STORAGE_KEY)
    if (raw == null) return sampleSubtitles
    return raw
  } catch {
    return sampleSubtitles
  }
}

function loadStoredTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark"

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === "dark" || raw === "light") return raw
    return "dark"
  } catch {
    return "dark"
  }
}

function parseTextList(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
}

const capitalizationTerms = parseTextList(capitalizationTermsText)
const punctuationAbbreviations = parseTextList(punctuationAbbreviationsText)
const properNouns = parseTextList(properNounsText)

function getFindingId(finding: Finding, index: number): string {
  return `${finding.type}-${finding.lineIndex}-${index}`
}

function findingTsLineIndex(finding: Finding): number {
  if (
    (finding.type === "MAX_CPS" || finding.type === "MIN_CPS") &&
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

    if (f.type === "MAX_CPS" || f.type === "MIN_CPS") {
      const first = parseBlockAt(src, findingTsLineIndex(f))
      if (first) {
        const translationIndices = mergedRunTranslationIndices(src, first)
        for (const i of translationIndices) {
          addWholeLine(id, i)
        }
      } else {
        addWholeLine(id, f.lineIndex)
      }
      continue
    }

    if (
      f.type === "NUMBER_STYLE" ||
      f.type === "DASH_STYLE" ||
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

    if (f.type === "MERGE_CANDIDATE" || f.type === "JOINABLE_BREAK") {
      addWholeLine(id, f.lineIndex)
      addWholeLine(id, f.nextLineIndex)
      continue
    }

    if (f.type === "SPAN_GAP") {
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
  severityKind: "error" | "warn"
  snippet: string | null
  detail: string
  explanation: string | null
} {
  const severity =
    "severity" in finding && finding.severity ? finding.severity : "warn"
  const severityIconClass =
    severity === "error" ? "las la-times-circle" : "las la-exclamation-triangle"

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
  const explanation = getFindingExplanation(finding)
  return { severityIconClass, severityKind: severity, snippet, detail, explanation }
}

function getFindingExplanation(finding: Finding): string | null {
  const instruction =
    typeof finding.instruction === "string" && finding.instruction.trim() !== ""
      ? finding.instruction.trim()
      : null

  if (finding.type === "MAX_CPS" || finding.type === "MIN_CPS") {
    return instruction
      ? `${instruction} Current: ${finding.cps.toFixed(1)} CPS.`
      : `Current: ${finding.cps.toFixed(1)} CPS.`
  }

  if (finding.type === "MAX_CHARS") {
    return instruction
      ? `${instruction} Current: ${finding.actual} characters.`
      : `Current: ${finding.actual} characters.`
  }

  return instruction
}

function getFindingAnchor(view: EditorView, finding: Finding): number {
  const doc = view.state.doc
  const safeLineIndex = Math.min(Math.max(finding.lineIndex, 0), doc.lines - 1)
  const line = doc.line(safeLineIndex + 1)

  if (
    finding.type === "MAX_CPS" ||
    finding.type === "MIN_CPS"
  ) {
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

function focusEditorContent(view: EditorView) {
  const content = view.contentDOM as HTMLElement | null
  if (!content || typeof content.focus !== "function") return
  try {
    content.focus({ preventScroll: true })
  } catch {
    content.focus()
  }
}

function clampScrollTop(value: number, scrollDOM: HTMLElement) {
  const maxScrollTop = Math.max(0, scrollDOM.scrollHeight - scrollDOM.clientHeight)
  return Math.min(Math.max(0, value), maxScrollTop)
}

function centerAnchorInContainer(
  view: EditorView,
  anchor: number,
  container: HTMLElement | null
) {
  if (!container) return
  const measuredView = view as EditorView & {
    coordsAtPos?: (pos: number, side?: number) => DOMRect | null
    requestMeasure?: (spec: {
      read: (view: EditorView) => { coords: DOMRect | null; containerTop: number } | null
      write: (
        data: { coords: DOMRect | null; containerTop: number } | null,
        view: EditorView
      ) => void
    }) => void
  }

  if (
    typeof measuredView.requestMeasure === "function" &&
    typeof measuredView.coordsAtPos === "function"
  ) {
    measuredView.requestMeasure({
      read() {
        return {
          coords: measuredView.coordsAtPos?.(anchor, 1) ?? null,
          containerTop: container.getBoundingClientRect().top,
        }
      },
      write(data) {
        if (!data?.coords) return
        const currentTop = container.scrollTop
        const top = data.coords.top - data.containerTop + currentTop
        const bottom = data.coords.bottom - data.containerTop + currentTop
        const targetScrollTop = (top + bottom) / 2 - container.clientHeight / 2
        container.scrollTop = clampScrollTop(targetScrollTop, container)
      },
    })
    return
  }

  const lineBlockAt = (view as EditorView & {
    lineBlockAt?: (pos: number) => { top: number; bottom: number }
  }).lineBlockAt
  if (typeof lineBlockAt !== "function") return
  const lineBlock = lineBlockAt(anchor)
  if (!lineBlock) return
  const lineCenter = (lineBlock.top + lineBlock.bottom) / 2
  const targetScrollTop = lineCenter - container.clientHeight / 2
  container.scrollTop = clampScrollTop(targetScrollTop, container)
}

function withTemporarySmoothScroll(view: EditorView, fn: () => void) {
  const touched = new Map<HTMLElement, string>()

  const apply = (el: Element | null | undefined) => {
    if (!(el instanceof HTMLElement) || touched.has(el)) return
    touched.set(el, el.style.scrollBehavior)
    el.style.scrollBehavior = "smooth"
  }

  apply(view.scrollDOM)

  let cur: HTMLElement | null = view.scrollDOM.parentElement
  while (cur) {
    if (cur.scrollHeight > cur.clientHeight + 1) apply(cur)
    cur = cur.parentElement
  }

  const docScroller = view.scrollDOM.ownerDocument?.scrollingElement
  if (docScroller instanceof HTMLElement) apply(docScroller)

  try {
    fn()
  } finally {
    window.setTimeout(() => {
      for (const [el, previous] of touched) {
        el.style.scrollBehavior = previous
      }
    }, 450)
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
  const [analysisType, setAnalysisType] = useState<AppAnalysisType>(() =>
    loadStoredAnalysisType()
  )
  const [theme, setTheme] = useState<"dark" | "light">(() => loadStoredTheme())
  const editorScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const [value, setValue] = useState(() => loadStoredEditorText())
  const [maxCps, setMaxCps] = useState(() => loadStoredCpsThreshold(MAX_CPS_STORAGE_KEY, MAX_CPS))
  const [minCps, setMinCps] = useState(() => loadStoredCpsThreshold(MIN_CPS_STORAGE_KEY, MIN_CPS))
  const [maxCpsDraft, setMaxCpsDraft] = useState(() => String(loadStoredCpsThreshold(MAX_CPS_STORAGE_KEY, MAX_CPS)))
  const [minCpsDraft, setMinCpsDraft] = useState(() => String(loadStoredCpsThreshold(MIN_CPS_STORAGE_KEY, MIN_CPS)))
  const [view, setView] = useState<EditorView | null>(null)
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null)
  const [enabledRuleTypes, setEnabledRuleTypes] = useState<Set<Finding["type"]>>(
    () => loadEnabledRuleTypes(loadStoredAnalysisType())
  )
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false)
  const [isRulesModalMounted, setIsRulesModalMounted] = useState(false)
  const [suppressFindingMotion, setSuppressFindingMotion] = useState(false)
  const pendingClickFindingIdRef = useRef<string | null>(null)
  const rulesModalCloseTimerRef = useRef<number | null>(null)
  const findingMotionTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (rulesModalCloseTimerRef.current !== null) {
        clearTimeout(rulesModalCloseTimerRef.current)
      }
      if (findingMotionTimerRef.current !== null) {
        clearTimeout(findingMotionTimerRef.current)
      }
    }
  }, [])

  const suppressFindingMotionForRuleChange = useCallback(() => {
    setSuppressFindingMotion(true)
    if (findingMotionTimerRef.current !== null) {
      clearTimeout(findingMotionTimerRef.current)
    }
    findingMotionTimerRef.current = window.setTimeout(() => {
      setSuppressFindingMotion(false)
      findingMotionTimerRef.current = null
    }, FINDINGS_MOTION_SUPPRESS_MS)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(MODE_STORAGE_KEY, analysisType)
  }, [analysisType])

  useEffect(() => {
    setEnabledRuleTypes(loadEnabledRuleTypes(analysisType))
  }, [analysisType])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      getRuleFiltersStorageKey(analysisType),
      JSON.stringify(Array.from(enabledRuleTypes))
    )
  }, [enabledRuleTypes, analysisType])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(MAX_CPS_STORAGE_KEY, String(maxCps))
    window.localStorage.setItem(MIN_CPS_STORAGE_KEY, String(minCps))
  }, [maxCps, minCps])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(EDITOR_TEXT_STORAGE_KEY, value)
  }, [value])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    setMaxCpsDraft(String(maxCps))
  }, [maxCps])

  useEffect(() => {
    setMinCpsDraft(String(minCps))
  }, [minCps])

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

  const toggleRule = useCallback((type: Finding["type"]) => {
    suppressFindingMotionForRuleChange()
    setEnabledRuleTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [suppressFindingMotionForRuleChange])

  const handleMaxCpsChange = useCallback((raw: string) => {
    setMaxCpsDraft(raw)
  }, [])

  const handleMinCpsChange = useCallback((raw: string) => {
    setMinCpsDraft(raw)
  }, [])

  const commitMaxCpsDraft = useCallback(() => {
    const parsed = Number(maxCpsDraft)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setMaxCpsDraft(String(maxCps))
      return
    }

    const nextMin = minCps > parsed ? parsed : minCps
    suppressFindingMotionForRuleChange()
    setMaxCps(parsed)
    setMinCps(nextMin)
  }, [maxCpsDraft, maxCps, minCps, suppressFindingMotionForRuleChange])

  const commitMinCpsDraft = useCallback(() => {
    const parsed = Number(minCpsDraft)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setMinCpsDraft(String(minCps))
      return
    }

    const nextMax = maxCps < parsed ? parsed : maxCps
    suppressFindingMotionForRuleChange()
    setMinCps(parsed)
    setMaxCps(nextMax)
  }, [minCpsDraft, minCps, maxCps, suppressFindingMotionForRuleChange])

  const analysisEnabledRuleTypes = useMemo(() => {
    const applicable = APPLICABLE_RULE_TYPES_BY_ANALYSIS_TYPE[analysisType]
    const filtered = Array.from(enabledRuleTypes).filter((type) => applicable.has(type))
    return includeWarnings
      ? filtered
      : filtered.filter((type) => !WARNING_RULE_TYPES.includes(type))
  }, [enabledRuleTypes, includeWarnings, analysisType])

  const rawRuleOutputs = useMemo<Metric[]>(() => {
    return buildAnalysisOutput({
      text: value,
      type: analysisType,
      ruleSet: "findings",
      output: "metrics",
      enabledRuleTypes: analysisEnabledRuleTypes,
      maxCps,
      minCps,
      capitalizationTerms,
      properNouns,
      abbreviations: punctuationAbbreviations,
    }) as Metric[]
  }, [value, analysisEnabledRuleTypes, maxCps, minCps, analysisType])

  const findings = useMemo<Finding[]>(() => {
    return getFindings(rawRuleOutputs, { includeWarnings })
  }, [rawRuleOutputs, includeWarnings])
  const sortedFindings = useMemo(() => sortFindingsWithIndex(findings), [findings])

  const cpsMetrics = useMemo<Metric[]>(() => {
    return buildAnalysisOutput({
      text: value,
      type: analysisType,
      ruleSet: "metrics",
      output: "metrics",
      enabledRuleTypes: analysisEnabledRuleTypes,
      maxCps,
      minCps,
      capitalizationTerms,
      properNouns,
      abbreviations: punctuationAbbreviations,
    }) as Metric[]
  }, [value, analysisEnabledRuleTypes, maxCps, minCps, analysisType])

  useEffect(() => {
    console.log("[analysis] cps metrics", cpsMetrics)
  }, [cpsMetrics])

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
      EditorView.lineWrapping,

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

  const handleFindingClick = useCallback(
    (finding: Finding, findingId: string) => {
      if (!view) return
      pendingClickFindingIdRef.current = findingId
      setActiveFindingId(findingId)
      const anchor = getFindingAnchor(view, finding)

      withTemporarySmoothScroll(view, () => {
        view.dispatch({
          selection: { anchor },
          effects: EditorView.scrollIntoView(anchor, { y: "center" }),
        })
        centerAnchorInContainer(view, anchor, editorScrollRef.current)
      })
      focusEditorContent(view)
    },
    [view]
  )

  const handleToggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"))
  }, [])

  const handleAnalysisTypeChange = useCallback(
    (nextType: AppAnalysisType) => {
      if (nextType === analysisType) return
      suppressFindingMotionForRuleChange()
      setAnalysisType(nextType)
    },
    [analysisType, suppressFindingMotionForRuleChange]
  )

  const applicableRuleTypes = APPLICABLE_RULE_TYPES_BY_ANALYSIS_TYPE[analysisType]

  return (
    <div
      className={`app-shell${suppressFindingMotion ? " findings-motion-paused" : ""}`}
    >
      <div className="app-topbar">
        <div className="mode-switcher" role="group" aria-label="Analysis mode">
          {ANALYSIS_TYPE_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              className={`mode-switcher-button${
                analysisType === option.type ? " is-active" : ""
              }`}
              aria-pressed={analysisType === option.type}
              onClick={() => handleAnalysisTypeChange(option.type)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="app-editor-wrap">
        <div className="app-editor-scroll" ref={editorScrollRef}>
          <div className="app-editor-inner">
            <CodeMirror
              value={value}
              onChange={setValue}
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
          <aside className="findings-sidebar">
            <div className="sidebar-header">
              <h3 className="sidebar-title">Findings</h3>
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
              <div className="sidebar-empty">No findings.</div>
            ) : (
              <ul className="findings-list">
                {sortedFindings.map(({ finding, index }) => {
                  const { severityIconClass, severityKind, snippet, detail, explanation } =
                    getFindingParts(finding)
                  const findingId = getFindingId(finding, index)
                  const isActive = activeFindingId === findingId
                  return (
                    <li key={findingId} className="findings-list-item">
                      <button
                        type="button"
                        onClick={() => handleFindingClick(finding, findingId)}
                        className={`finding-row-button${isActive ? " is-active" : ""}`}
                      >
                        <span className="finding-row-head">
                          <i
                            className={severityIconClass}
                            aria-hidden="true"
                            data-severity={severityKind}
                          />
                          <span className="finding-row-detail">
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
                          <span className="finding-row-snippet">
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
        </div>
      </div>

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
              <h3 className="rules-modal-title">Rules</h3>
              <button
                type="button"
                className="rules-modal-close-button"
                aria-label="Close rules modal"
                onClick={closeRulesModal}
              >
                <i className="las la-times" aria-hidden="true" />
              </button>
            </div>
            <div className="rules-modal-groups">
              <div className="rules-modal-group">
                <div className="rules-modal-group-title">
                  <i
                    className="las la-times-circle"
                    aria-hidden="true"
                    data-severity="error"
                  />
                  <span>Errors</span>
                </div>
                {RULE_OPTIONS.filter((rule) => rule.severity === "error").map((rule) => (
                  <div
                    key={rule.type}
                    className={`rules-modal-rule${
                      applicableRuleTypes.has(rule.type) ? "" : " is-disabled"
                    }`}
                  >
                    <label className="rules-modal-checkbox">
                      <input
                        type="checkbox"
                        checked={enabledRuleTypes.has(rule.type)}
                        disabled={!applicableRuleTypes.has(rule.type)}
                        onChange={() => toggleRule(rule.type)}
                      />
                      <span className="rules-modal-checkbox-label">{rule.label}</span>
                      <span className="rules-modal-checkbox-help">{rule.explanation}</span>
                    </label>
                    {rule.type === "MAX_CPS" ? (
                      <div className="rules-modal-threshold">
                        <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={maxCpsDraft}
                            aria-label="Max CPS"
                            placeholder="Max CPS"
                            disabled={
                              !applicableRuleTypes.has("MAX_CPS") ||
                              !enabledRuleTypes.has("MAX_CPS")
                            }
                            onChange={(e) => handleMaxCpsChange(e.target.value)}
                            onBlur={commitMaxCpsDraft}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur()
                            }}
                            className="rules-modal-threshold-input"
                          />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="rules-modal-group">
                <div className="rules-modal-group-title">
                  <i
                    className="las la-exclamation-triangle"
                    aria-hidden="true"
                    data-severity="warn"
                  />
                  <span>Warnings</span>
                </div>
                {RULE_OPTIONS.filter((rule) => rule.severity === "warn").map((rule) => (
                  <div
                    key={rule.type}
                    className={`rules-modal-rule${
                      applicableRuleTypes.has(rule.type) ? "" : " is-disabled"
                    }`}
                  >
                    <label className="rules-modal-checkbox">
                      <input
                        type="checkbox"
                        checked={enabledRuleTypes.has(rule.type)}
                        disabled={!applicableRuleTypes.has(rule.type)}
                        onChange={() => toggleRule(rule.type)}
                      />
                      <span className="rules-modal-checkbox-label">{rule.label}</span>
                      <span className="rules-modal-checkbox-help">{rule.explanation}</span>
                    </label>
                    {rule.type === "MIN_CPS" ? (
                      <div className="rules-modal-threshold">
                        <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={minCpsDraft}
                            aria-label="Min CPS"
                            placeholder="Min CPS"
                            disabled={
                              !applicableRuleTypes.has("MIN_CPS") ||
                              !enabledRuleTypes.has("MIN_CPS")
                            }
                            onChange={(e) => handleMinCpsChange(e.target.value)}
                            onBlur={commitMinCpsDraft}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur()
                            }}
                            className="rules-modal-threshold-input"
                          />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Toggle theme"
        className="sidebar-gear-button floating-theme-toggle"
        onClick={handleToggleTheme}
      >
        <i
          className={theme === "dark" ? "las la-sun" : "las la-moon"}
          aria-hidden="true"
        />
      </button>

    </div>
  )
}
