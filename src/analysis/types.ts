export type LineContext = {
  line: string
  lineIndex: number

  // for multi-line rules (CPS)
  lines: string[]
  getLine: (index: number) => string | undefined
}

export type MaxCharsViolation = {
  type: 'MAX_CHARS'
  lineIndex: number
  text: string
  maxAllowed: number
  actual: number
}

export type CPSViolation = {
  type: 'CPS'
  lineIndex: number
  text: string
  cps: number
  maxCps: number
  durationFrames: number
  charCount: number
}

export type Violation = MaxCharsViolation | CPSViolation

export type Rule = (ctx: LineContext) => Violation[]
