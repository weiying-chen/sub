import { baselineRule } from "./baselineRule"
import { capitalizationRule } from "./capitalizationRule"
import { cpsBalanceRule } from "./cpsBalanceRule"
import { cpsRule } from "./cpsRule"
import { leadingWhitespaceRule } from "./leadingWhitespaceRule"
import { maxCharsRule } from "./maxCharsRule"
import { mergeCandidateRule } from "./mergeCandidateRule"
import { numberStyleRule } from "./numberStyleRule"
import { percentStyleRule } from "./percentStyleRule"
import { punctuationRule } from "./punctuationRule"
import type { SegmentRule } from "./segments"
import type { Metric } from "./types"

type CreateSubsSegmentRulesOptions = {
  capitalizationTerms?: string[]
  properNouns?: string[]
  baselineText?: string
  ignoreEmptyLines?: boolean
  enabledFindingTypes?: Iterable<Metric["type"]>
}

const CPS_RULE_TYPES: Metric["type"][] = ["CPS", "MAX_CPS", "MIN_CPS"]

function isEnabled(
  enabled: Set<Metric["type"]> | null,
  types: Metric["type"] | Metric["type"][]
): boolean {
  if (!enabled) return true
  if (Array.isArray(types)) return types.some((type) => enabled.has(type))
  return enabled.has(types)
}

export function createSubsSegmentRules(
  options: CreateSubsSegmentRulesOptions = {}
): SegmentRule[] {
  const enabled = options.enabledFindingTypes
    ? new Set<Metric["type"]>(options.enabledFindingTypes)
    : null
  const rules: SegmentRule[] = []

  if (isEnabled(enabled, "MAX_CHARS")) {
    rules.push(maxCharsRule(54))
  }
  if (isEnabled(enabled, "LEADING_WHITESPACE")) {
    rules.push(leadingWhitespaceRule())
  }
  if (isEnabled(enabled, CPS_RULE_TYPES)) {
    rules.push(
      cpsRule(undefined, undefined, {
        ignoreEmptyLines: options.ignoreEmptyLines,
      })
    )
  }
  if (isEnabled(enabled, "CPS_BALANCE")) {
    rules.push(cpsBalanceRule({ ignoreEmptyLines: options.ignoreEmptyLines }))
  }
  if (isEnabled(enabled, "MERGE_CANDIDATE")) {
    rules.push(mergeCandidateRule({ ignoreEmptyLines: options.ignoreEmptyLines }))
  }
  if (isEnabled(enabled, "CAPITALIZATION")) {
    rules.push(capitalizationRule({ terms: options.capitalizationTerms }))
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
        ignoreEmptyLines: options.ignoreEmptyLines,
      })
    )
  }

  if (options.baselineText != null && isEnabled(enabled, "BASELINE")) {
    rules.push(baselineRule(options.baselineText))
  }

  return rules
}
