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
  maxChars: number,
  options: { allowSentenceEndJoin?: boolean } = {}
): { joined: string; joinedLength: number } | null {
  const allowSentenceEndJoin = options.allowSentenceEndJoin ?? false
  const left = normalizeJoinText(leftRaw)
  const right = normalizeJoinText(rightRaw)
  if (!left || !right) return null
  if (left === right) return null
  const leftEndsSentence = endsWithTerminalSentencePunctuation(left)
  const rightEndsSentence = endsWithTerminalSentencePunctuation(right)
  if (leftEndsSentence && !allowSentenceEndJoin) return null
  if (leftEndsSentence && allowSentenceEndJoin && !rightEndsSentence) return null
  if (looksLikeSentenceFragment(left) && endsWithPeriod(left)) return null
  if (leftEndsSentence && looksLikeSentenceFragment(right) && !rightEndsSentence) {
    return null
  }

  const joined = `${left} ${right}`.trim()
  if (joined.length > maxChars) return null
  return { joined, joinedLength: joined.length }
}
