export type Token =
  | { type: 'word'; text: string }
  | { type: 'punct'; text: string }

/**
 * Tokenize subtitle text into words + punctuation.
 * - Spaces are NOT tokenized.
 * - Ellipsis, dashes, quotes are preserved as punctuation tokens.
 * - Words may contain internal apostrophes or hyphens (didn't, well-known).
 */
export function tokenizeText(input: string): Token[] {
  const s = input.replace(/\s+/g, ' ').trim()
  if (!s) return []

  const tokens: Token[] = []
  let i = 0

  const isWordChar = (ch: string) => /[A-Za-z0-9]/.test(ch)
  const isJoiner = (ch: string) => ch === "'" || ch === '-'

  while (i < s.length) {
    const ch = s[i]

    // Skip spaces entirely
    if (ch === ' ') {
      i++
      continue
    }

    // Ellipsis
    if (s.startsWith('...', i)) {
      tokens.push({ type: 'punct', text: '...' })
      i += 3
      continue
    }

    // Unicode ellipsis
    if (ch === '…') {
      tokens.push({ type: 'punct', text: '…' })
      i++
      continue
    }

    // Em / en dash
    if (ch === '—' || ch === '–') {
      tokens.push({ type: 'punct', text: ch })
      i++
      continue
    }

    // Double hyphen
    if (s.startsWith('--', i)) {
      tokens.push({ type: 'punct', text: '--' })
      i += 2
      continue
    }

    // Word
    if (isWordChar(ch)) {
      let j = i + 1
      while (j < s.length) {
        const c = s[j]

        if (isWordChar(c)) {
          j++
          continue
        }

        // Allow internal joiners: didn't, well-known
        if (isJoiner(c)) {
          const prev = s[j - 1]
          const next = s[j + 1]
          if (prev && next && isWordChar(prev) && isWordChar(next)) {
            j++
            continue
          }
        }

        break
      }

      tokens.push({ type: 'word', text: s.slice(i, j) })
      i = j
      continue
    }

    // Fallback: single punctuation char
    tokens.push({ type: 'punct', text: ch })
    i++
  }

  return tokens
}
