import type { Metric } from './types'

import { type ParseBlockOptions, parseBlockAt } from '../shared/tsvRuns'

export type CandidateLine = {
  lineIndex: number
  text: string
}

export type NewsMarker = {
  raw: string
  lineIndex: number
  index: number | null
  time: number | null
  valid: boolean
}

export type SuperPersonEntry = {
  zhTitle: string
  zhName: string
  enName: string
  enTitle: string
  organization?: string
}

export type Segment = {
  lineIndex: number
  lineIndexEnd?: number
  text: string
  blockType?: 'vo' | 'super' | 'super_people'
  marker?: NewsMarker
  superPerson?: SuperPersonEntry
  sourceText?: string
  tsIndex?: number
  payloadIndex?: number
  startFrames?: number
  endFrames?: number
  sourceLines?: CandidateLine[]
  targetLines?: CandidateLine[]
}

export type SegmentCtx = {
  segment: Segment
  segmentIndex: number
  segments: Segment[]
  lines?: string[]
  sourceText?: string
}

export type SegmentRule = (ctx: SegmentCtx) => Metric[]

export function analyzeSegments(
  segments: Segment[],
  rules: SegmentRule[],
  options: { lines?: string[]; sourceText?: string } = {}
): Metric[] {
  const metrics: Metric[] = []
  const { lines, sourceText } = options

  segments.forEach((segment, segmentIndex) => {
    const ctx = {
      segment,
      segmentIndex,
      segments,
      lines,
      sourceText,
    }

    for (const rule of rules) {
      metrics.push(...rule(ctx))
    }
  })

  return metrics
}

export function parseSubs(
  text: string,
  options: ParseBlockOptions = {}
): Segment[] {
  const lines = text.split('\n')
  const src = {
    lineCount: lines.length,
    getLine: (i: number) => lines[i] ?? '',
  }

  const segments: Segment[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const block = parseBlockAt(src, i, options)
    if (!block) continue
    const targetLines = isEnglishLikeLine(block.payloadText)
      ? [{ lineIndex: block.payloadIndex, text: block.payloadText }]
      : []
    segments.push({
      lineIndex: block.payloadIndex,
      lineIndexEnd: block.payloadIndex,
      text: block.payloadText,
      tsIndex: block.tsIndex,
      payloadIndex: block.payloadIndex,
      startFrames: block.startFrames,
      endFrames: block.endFrames,
      targetLines,
    })
  }

  return segments
}

export function parseNews(text: string): Segment[] {
  const lines = text.split('\n')
  const segments: Segment[] = []

  let sourceBuffer: CandidateLine[] = []
  let targetBuffer: CandidateLine[] = []
  let currentBlock: Segment['blockType'] | null = null
  let currentMarker: NewsMarker | undefined
  let pendingMarker: NewsMarker | undefined
  let inComment = false
  let inSuperComment = false
  let inSuperPeopleSection = false
  let superPeopleBuffer: CandidateLine[] = []
  let superActive = false

  const flush = () => {
    if (!currentBlock || (sourceBuffer.length === 0 && targetBuffer.length === 0)) {
      sourceBuffer = []
      targetBuffer = []
      currentBlock = null
      return
    }

    const anchorLines = targetBuffer.length > 0 ? targetBuffer : sourceBuffer
    const lineIndex = anchorLines[0].lineIndex
    const lineIndexEnd = anchorLines[anchorLines.length - 1].lineIndex
    segments.push({
      lineIndex,
      lineIndexEnd,
      marker: currentMarker,
      text: targetBuffer.map((line) => line.text.trim()).join(' '),
      sourceText: sourceBuffer.map((line) => line.text.trim()).join(' '),
      sourceLines: sourceBuffer,
      targetLines: targetBuffer,
      blockType: currentBlock,
    })
    sourceBuffer = []
    targetBuffer = []
    currentBlock = null
    currentMarker = undefined
  }

  const flushSuperPeople = () => {
    if (superPeopleBuffer.length === 0) return

    const first = superPeopleBuffer[0]
    const last = superPeopleBuffer[superPeopleBuffer.length - 1]
    const entry = parseSuperPersonEntry(superPeopleBuffer)

    segments.push({
      lineIndex: first.lineIndex,
      lineIndexEnd: last.lineIndex,
      text: superPeopleBuffer.map((line) => line.text.trim()).join(' '),
      blockType: 'super_people',
      targetLines: [...superPeopleBuffer],
      superPerson: entry,
    })

    superPeopleBuffer = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (trimmed === 'SUPER_PEOPLE:') {
      flush()
      inSuperPeopleSection = true
      superActive = false
      continue
    }

    if (inSuperPeopleSection) {
      if (trimmed === '') {
        flushSuperPeople()
        continue
      }

      const parsedMarker = parseNewsMarker(trimmed, i)
      if (parsedMarker) {
        flushSuperPeople()
        inSuperPeopleSection = false
        pendingMarker = parsedMarker
        continue
      }

      if (trimmed === '字幕：') {
        flushSuperPeople()
        inSuperPeopleSection = false
        continue
      }

      superPeopleBuffer.push({ lineIndex: i, text: raw })
      continue
    }

    const isSuperStart = trimmed.startsWith('/*SUPER')
    const isCommentStart = trimmed.startsWith('/*')
    const isCommentEnd = trimmed.includes('*/')

    if (isCommentStart) {
      flush()
      inComment = true
      inSuperComment = isSuperStart
      if (isCommentEnd) {
        inComment = false
        if (inSuperComment) superActive = true
        inSuperComment = false
      }
      continue
    }

    if (inComment) {
      if (inSuperComment && isNewsSourceLine(raw)) {
        currentBlock = 'super'
        sourceBuffer.push({ lineIndex: i, text: raw.trim() })
      }
      if (isCommentEnd) {
        inComment = false
        if (inSuperComment) superActive = true
        inSuperComment = false
      }
      continue
    }

    if (trimmed === '') {
      flush()
      superActive = false
      continue
    }

    const parsedMarker = parseNewsMarker(trimmed, i)
    if (parsedMarker) {
      flush()
      pendingMarker = parsedMarker
      superActive = false
      continue
    }

    if (isNewsStructureLine(trimmed)) {
      flush()
      superActive = false
      continue
    }

    if (isEnglishLikeLine(raw)) {
      const blockType: Segment['blockType'] = superActive ? 'super' : 'vo'
      if (currentBlock && currentBlock !== blockType) {
        flush()
      }

      if (!currentBlock) {
        currentMarker = pendingMarker
        pendingMarker = undefined
      }
      currentBlock = blockType
      targetBuffer.push({ lineIndex: i, text: raw })
      continue
    }

    if (isNewsSourceLine(raw)) {
      const blockType: Segment['blockType'] = superActive ? 'super' : 'vo'
      if (targetBuffer.length > 0 || (currentBlock && currentBlock !== blockType)) {
        flush()
      }

      if (!currentBlock) {
        currentMarker = pendingMarker
        pendingMarker = undefined
      }
      currentBlock = blockType
      sourceBuffer.push({ lineIndex: i, text: raw.trim() })
      continue
    }

    if (!isEnglishLikeLine(raw)) {
      flush()
      superActive = false
      continue
    }
  }

  if (inSuperPeopleSection) flushSuperPeople()
  flush()

  return segments
}

function parseSuperPersonEntry(lines: CandidateLine[]): SuperPersonEntry {
  const [zhLine, ...englishLines] = lines.map((line) => line.text.trim())
  const [zhTitle = '', zhName = ''] = zhLine.split('|').map((part) => part.trim())
  let enName = ''
  let enTitle = ''
  let organization: string | undefined

  if (englishLines.length >= 2) {
    enName = englishLines[0] ?? ''
    enTitle = englishLines[1] ?? ''
    organization = englishLines.slice(2).join(' ').trim() || undefined
  } else if (englishLines.length === 1) {
    const loneLine = englishLines[0] ?? ''
    if (looksLikeSuperPersonName(loneLine)) {
      enName = loneLine
    } else {
      enTitle = loneLine
    }
  }

  return {
    zhTitle,
    zhName,
    enName,
    enTitle,
    organization,
  }
}

function looksLikeSuperPersonName(text: string): boolean {
  const words = text.match(/[A-Za-z][A-Za-z.'-]*/g) ?? []
  if (words.length === 0 || words.length > 4) return false

  return words.every(
    (word) =>
      /^[A-Z][a-z.'-]*$/.test(word) ||
      /^[A-Z]{2,}$/.test(word) ||
      /^(?:Dr|Mr|Mrs|Ms)\.?$/.test(word)
  )
}

function isNewsLabel(text: string): boolean {
  return /^[A-Z]{2,5}:$/.test(text)
}

function isNewsStructureLine(text: string): boolean {
  if (isNewsLabel(text)) return true
  if (/^[<>]+$/.test(text)) return true
  return false
}

function parseNewsMarker(text: string, lineIndex: number): NewsMarker | null {
  if (!/^\S+_\S+$/.test(text)) return null

  const match = /^(\d+)_([0-9]{4})$/.exec(text)
  if (!match) {
    return {
      raw: text,
      lineIndex,
      index: null,
      time: null,
      valid: false,
    }
  }

  return {
    raw: text,
    lineIndex,
    index: Number(match[1]),
    time: Number(match[2]),
    valid: true,
  }
}

function isNewsSourceLine(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return false
  if (trimmed.startsWith('(') || trimmed.startsWith('[')) return false
  if (trimmed.startsWith('/*') || trimmed === '*/') return false
  if (isNewsStructureLine(trimmed)) return false

  const cjkRe = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/
  return cjkRe.test(trimmed)
}

function isEnglishLikeLine(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return false
  if (trimmed.startsWith('(') || trimmed.startsWith('[')) return false
  if (trimmed.startsWith('/*')) return false

  const cjkRe = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/
  if (cjkRe.test(text)) return false

  const letters = text.match(/[A-Za-z]/g)
  return (letters?.length ?? 0) >= 3
}
