function firstAlphaChar(text: string): string {
  return text.match(/[A-Za-z]/)?.[0] ?? ''
}

export function looksLikeSentenceFragment(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true

  const firstAlpha = firstAlphaChar(trimmed)
  if (firstAlpha && firstAlpha === firstAlpha.toLowerCase()) return true

  const words = trimmed
    .replace(/^["']+|["']+$/g, '')
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''))
    .filter(Boolean)

  if (words.length <= 1) return true

  const firstWord = (words[0] ?? '').toLowerCase()
  if (!firstWord) return true
  if (/\b(and|but|or|so|yet|nor)\b/i.test(firstWord)) return true

  return false
}
