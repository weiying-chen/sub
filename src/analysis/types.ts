export type LineContext = {
  line: string
  lineIndex: number

  // for multi-line rules (CPS)
  lines: string[]
  getLine: (index: number) => string | undefined
}

export type MaxCharsFinding = {
  type: 'MAX_CHARS'
  lineIndex: number
  text: string
  maxAllowed: number
  actual: number
}

export type CPSFinding = {
  type: 'CPS'
  lineIndex: number
  text: string
  cps: number
  maxCps: number
  durationFrames: number
  charCount: number
}

export type Finding = MaxCharsFinding | CPSFinding

export type Rule = (ctx: LineContext) => Finding[]
