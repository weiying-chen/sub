export type CaptionLine = {
  lineIndex: number
  lineText: string
}

function stripTrailingClosers(text: string): string {
  return text.replace(/["'\)\]\}）］】》]+$/g, "")
}

export function isCaptionLine(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 2) return false
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  return (first === "(" || first === "（") && (last === ")" || last === "）")
}

export function hasTrailingCaptionPeriod(text: string): boolean {
  const trimmed = stripTrailingClosers(text.trimEnd())
  if (!trimmed.endsWith(".")) return false
  return !trimmed.slice(0, -1).endsWith(".")
}

export function isCaptionBlock(lines: CaptionLine[]): boolean {
  if (lines.length === 0) return false
  const trimmed = lines.map((line) => line.lineText.trim()).filter(Boolean)
  if (trimmed.length === 0) return false
  const first = trimmed[0] ?? ""
  const last = trimmed[trimmed.length - 1] ?? ""
  const opens = first.startsWith("(") || first.startsWith("（")
  const closes = last.endsWith(")") || last.endsWith("）")
  return opens && closes
}
