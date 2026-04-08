import { baselineRule } from "./baselineRule"
import { blockStructureRule } from "./blockStructureRule"
import { capitalizationRule } from "./capitalizationRule"
import { cpsRule } from "./cpsRule"
import { dashStyleRule } from "./dashStyleRule"
import { leadingWhitespaceRule } from "./leadingWhitespaceRule"
import { maxCharsRule } from "./maxCharsRule"
import { maxCpsRule } from "./maxCpsRule"
import { mergeCandidateRule } from "./mergeCandidateRule"
import { minCpsRule } from "./minCpsRule"
import { numberStyleRule } from "./numberStyleRule"
import { percentStyleRule } from "./percentStyleRule"
import { punctuationRule } from "./punctuationRule"
import { spanGapRule } from "./spanGapRule"
import { timestampFormatRule } from "./timestampFormatRule"
import { DEFAULT_MAX_CHARS } from "../shared/maxChars"
import type { SegmentRule } from "./segments"
import type { Metric } from "./types"

export type CreateSubsSegmentRulesOptions = {
  capitalizationTerms?: string[]
  properNouns?: string[]
  abbreviations?: string[]
  baselineText?: string
  maxChars?: number
  ignoreEmptyLines?: boolean
  enabledFindingTypes?: Iterable<Metric["type"]>
}

function isEnabled(
  enabled: Set<Metric["type"]> | null,
  types: Metric["type"] | Metric["type"][]
): boolean {
  if (!enabled) return true
  if (Array.isArray(types)) return types.some((type) => enabled.has(type))
  return enabled.has(types)
}

function createSubsCommonRules(
  options: CreateSubsSegmentRulesOptions = {}
): {
  enabled: Set<Metric["type"]> | null
  rules: SegmentRule[]
} {
  const enabled = options.enabledFindingTypes
    ? new Set<Metric["type"]>(options.enabledFindingTypes)
    : null
  const rules: SegmentRule[] = []
  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_MAX_CHARS)

  if (isEnabled(enabled, "MAX_CHARS")) {
    rules.push(maxCharsRule(maxChars))
  }
  if (isEnabled(enabled, "BLOCK_STRUCTURE")) {
    rules.push(blockStructureRule({ ignoreEmptyLines: options.ignoreEmptyLines }))
  }
  if (isEnabled(enabled, "TIMESTAMP_FORMAT")) {
    rules.push(timestampFormatRule())
  }
  if (isEnabled(enabled, "LEADING_WHITESPACE")) {
    rules.push(leadingWhitespaceRule())
  }
  if (isEnabled(enabled, "SPAN_GAP")) {
    rules.push(spanGapRule())
  }
  if (isEnabled(enabled, "MERGE_CANDIDATE")) {
    rules.push(mergeCandidateRule({ ignoreEmptyLines: options.ignoreEmptyLines }))
  }
  if (isEnabled(enabled, "CAPITALIZATION")) {
    rules.push(capitalizationRule({ terms: options.capitalizationTerms }))
  }
  if (isEnabled(enabled, "DASH_STYLE")) {
    rules.push(dashStyleRule())
  }
  if (isEnabled(enabled, "PERCENT_STYLE")) {
    rules.push(percentStyleRule())
  }
  if (isEnabled(enabled, "NUMBER_STYLE")) {
    rules.push(numberStyleRule())
  }
  if (isEnabled(enabled, "PUNCTUATION")) {
    rules.push(
      punctuationRule({
        properNouns: options.properNouns,
        abbreviations: options.abbreviations,
        ignoreEmptyLines: options.ignoreEmptyLines,
      })
    )
  }

  return { enabled, rules }
}

export function createSubsFindingsRules(
  options: CreateSubsSegmentRulesOptions = {}
): SegmentRule[] {
  const { enabled, rules } = createSubsCommonRules(options)

  if (isEnabled(enabled, "MAX_CPS")) {
    rules.push(
      maxCpsRule(undefined, undefined, {
        ignoreEmptyLines: options.ignoreEmptyLines,
      })
    )
  }
  if (isEnabled(enabled, "MIN_CPS")) {
    rules.push(
      minCpsRule(undefined, undefined, {
        ignoreEmptyLines: options.ignoreEmptyLines,
      })
    )
  }
  if (options.baselineText != null && isEnabled(enabled, "BASELINE")) {
    rules.push(baselineRule(options.baselineText))
  }

  return rules
}

export function createSubsMetricsRules(
  options: CreateSubsSegmentRulesOptions = {}
): SegmentRule[] {
  const enabled = options.enabledFindingTypes
    ? new Set<Metric["type"]>(options.enabledFindingTypes)
    : null
  const rules: SegmentRule[] = []
  if (
    isEnabled(enabled, "CPS") ||
    isEnabled(enabled, "MAX_CPS") ||
    isEnabled(enabled, "MIN_CPS")
  ) {
    rules.push(
      cpsRule(undefined, undefined, {
        ignoreEmptyLines: options.ignoreEmptyLines,
      })
    )
  }
  return rules
}

// Backward-compatible alias used by UI and watch findings paths.
export const createSubsSegmentRules = createSubsFindingsRules
