import { looksLikeSentenceFragment } from './sentenceFragments'

export function normalizeJoinText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function endsWithPeriod(text: string): boolean {
  return /\.\s*(?:["')\]]\s*)?$/.test(text)
}

export function endsWithTerminalSentencePunctuation(text: string): boolean {
  return /[.?!]\s*(?:["')\]]\s*)?$/.test(text)
}

export function canJoinAdjacentText(
  leftRaw: string,
  rightRaw: string,
  maxChars: number
): { joined: string; joinedLength: number } | null {
  const left = normalizeJoinText(leftRaw)
  const right = normalizeJoinText(rightRaw)
  if (!left || !right) return null
  if (left === right) return null
  if (endsWithTerminalSentencePunctuation(left)) return null
  if (looksLikeSentenceFragment(left) && endsWithPeriod(left)) return null
  if (endsWithTerminalSentencePunctuation(left) && looksLikeSentenceFragment(right)) {
    return null
  }

  const joined = `${left} ${right}`.trim()
  if (joined.length > maxChars) return null
  return { joined, joinedLength: joined.length }
}
