export type DoubleQuoteSpanInfo = {
  quoteCount: number
  hasLeadingQuote: boolean
  hasTrailingQuote: boolean
  isOpeningAtStart: boolean
  isClosingAtEnd: boolean
  isWrapped: boolean
  leadingQuoteIsContinuation: boolean
  nextQuoteOpen: boolean
}

export function countDoubleQuotes(text: string): number {
  return (text.match(/"/g) ?? []).length
}

export function hasLeadingDoubleQuote(text: string): boolean {
  return /^\s*"/.test(text)
}

export function hasTrailingDoubleQuote(text: string): boolean {
  return /"\s*$/.test(text)
}

export function analyzeDoubleQuoteSpan(
  text: string,
  quoteOpen: boolean
): DoubleQuoteSpanInfo {
  const quoteCount = countDoubleQuotes(text)
  const hasLeadingQuote = hasLeadingDoubleQuote(text)
  const hasTrailingQuote = hasTrailingDoubleQuote(text)

  const isOpeningAtStart = hasLeadingQuote && !quoteOpen
  const isClosingAtEnd = hasTrailingQuote && quoteOpen
  const isWrapped = hasLeadingQuote && hasTrailingQuote && !quoteOpen
  const leadingQuoteIsContinuation = hasLeadingQuote && quoteOpen

  let nextQuoteOpen = quoteOpen
  if (isWrapped) {
    nextQuoteOpen = false
  } else if (isOpeningAtStart) {
    nextQuoteOpen = !hasTrailingQuote
  } else if (isClosingAtEnd) {
    nextQuoteOpen = false
  }

  return {
    quoteCount,
    hasLeadingQuote,
    hasTrailingQuote,
    isOpeningAtStart,
    isClosingAtEnd,
    isWrapped,
    leadingQuoteIsContinuation,
    nextQuoteOpen,
  }
}

export function createDoubleQuoteSpanTracker(initialQuoteOpen = false) {
  let quoteOpen = initialQuoteOpen

  return {
    inspect(text: string): DoubleQuoteSpanInfo {
      const info = analyzeDoubleQuoteSpan(text, quoteOpen)
      quoteOpen = info.nextQuoteOpen
      return info
    },
    isOpen(): boolean {
      return quoteOpen
    },
  }
}
