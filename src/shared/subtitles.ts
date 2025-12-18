// Shared subtitle parsing utilities (analysis + CM UI)

export const FPS = 30
export const MAX_CPS = 17

// hh:mm:ss:ff
export const TIME_RE =
  /^(?<h>\d{2}):(?<m>\d{2}):(?<s>\d{2}):(?<f>\d{2})$/

export const TSV_RE =
  /^(?<start>\d{2}:\d{2}:\d{2}:\d{2})\t+(?<end>\d{2}:\d{2}:\d{2}:\d{2})\t+.*$/

export function parseTimecodeToFrames(tc: string): number | null {
  const m = tc.trim().match(TIME_RE)
  if (!m?.groups) return null

  const h = Number(m.groups.h)
  const mn = Number(m.groups.m)
  const s = Number(m.groups.s)
  const f = Number(m.groups.f)

  if (
    !Number.isFinite(h) ||
    !Number.isFinite(mn) ||
    !Number.isFinite(s) ||
    !Number.isFinite(f)
  ) {
    return null
  }

  if (f < 0 || f >= FPS) return null

  return h * 108000 + mn * 1800 + s * 30 + f
}

/**
 * Extract inline subtitle text from a timestamp line.
 * Example:
 * 00:00:01:12\t00:00:03:04\tHello world
 * → "Hello world"
 *
 * Returns null if the line is not a valid timestamp line
 * or has no inline text.
 */
const TSV_INLINE_TEXT_RE =
  /^(?:\d{2}:\d{2}:\d{2}:\d{2})\t+(?:\d{2}:\d{2}:\d{2}:\d{2})\t+(?<text>.+)$/

export function extractInlineSubtitleText(line: string): string | null {
  const m = line.match(TSV_INLINE_TEXT_RE)
  if (!m?.groups?.text) return null
  return m.groups.text.trim()
}

/**
 * Extract inline subtitle text from a line range
 * and join into a single sentence (for ChatGPT, etc.)
 */
export function extractInlineTextFromRange(
  lines: string[],
  fromLine: number,
  toLine: number
): string {
  const parts: string[] = []

  for (let i = fromLine; i <= toLine; i++) {
    const text = extractInlineSubtitleText(lines[i])
    if (text) parts.push(text)
  }

  return parts.join(' ')
}
