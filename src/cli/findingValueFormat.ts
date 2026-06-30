const CLI_VALUE_LABELS: Record<string, string> = {
  em_dash: "em dash",
  en_dash: "en dash",
  triple_hyphen: "triple hyphens",
}

export function formatCliFindingValue(value: string): string {
  return CLI_VALUE_LABELS[value] ?? value
}
