export function normalizeRuleFilters<T>(ruleFilters: T[]): T[] | undefined {
  return ruleFilters.length > 0 ? ruleFilters : undefined
}
