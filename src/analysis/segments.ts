import type { Metric } from './types'

import { TSV_RE } from '../shared/subtitles'
import { parseBlockAt } from '../shared/tsvRuns'

export type CandidateLine = {
  lineIndex: number
  text: string
}

export type Segment = {
  lineIndex: number
  lineIndexEnd?: number
  text: string
  blockType?: 'vo' | 'super'
  tsIndex?: number
  payloadIndex?: number
  startFrames?: number
  endFrames?: number
  candidateLines?: CandidateLine[]
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

export function parseSubs(text: string): Segment[] {
  const lines = text.split('\n')
  const src = {
    lineCount: lines.length,
    getLine: (i: number) => lines[i] ?? '',
  }

  const segments: Segment[] = []
  const payloadIndices = new Set<number>()

  for (let i = 0; i < lines.length; i += 1) {
    const block = parseBlockAt(src, i)
    if (!block) continue
    const candidateLines = isEnglishLikeLine(block.payloadText)
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
      candidateLines,
    })
    payloadIndices.add(block.payloadIndex)
  }

  let inComment = false
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.includes('/*')) inComment = true
    if (trimmed.includes('*/')) {
      inComment = false
      continue
    }

    if (inComment) continue
    if (trimmed === '') continue
    if (TSV_RE.test(line)) continue
    if (payloadIndices.has(i)) continue

    const candidateLines = isEnglishLikeLine(line)
      ? [{ lineIndex: i, text: line }]
      : []
    segments.push({
      lineIndex: i,
      lineIndexEnd: i,
      text: line,
      candidateLines,
    })
  }

  return segments
}

export function parseNews(text: string): Segment[] {
  const lines = text.split('\n')
  const segments: Segment[] = []

  let buffer: CandidateLine[] = []
  let bufferText: string[] = []
  let currentBlock: Segment['blockType'] | null = null
  let inComment = false
  let inSuperComment = false
  let superActive = false

  const flush = () => {
    if (!currentBlock || buffer.length === 0) {
      buffer = []
      bufferText = []
      currentBlock = null
      return
    }

    const lineIndex = buffer[0].lineIndex
    const lineIndexEnd = buffer[buffer.length - 1].lineIndex
    segments.push({
      lineIndex,
      lineIndexEnd,
      text: bufferText.join(' '),
      candidateLines: buffer,
      blockType: currentBlock,
    })
    buffer = []
    bufferText = []
    currentBlock = null
  }

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    const trimmed = raw.trim()

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
      if (isCommentEnd) {
        inComment = false
        if (inSuperComment) superActive = true
        inSuperComment = false
      }
      continue
    }

    if (trimmed === '' || isNewsLabel(trimmed)) {
      flush()
      superActive = false
      continue
    }

    if (!isEnglishLikeLine(raw)) {
      flush()
      superActive = false
      continue
    }

    const blockType: Segment['blockType'] = superActive ? 'super' : 'vo'
    if (currentBlock && currentBlock !== blockType) {
      flush()
    }

    currentBlock = blockType
    buffer.push({ lineIndex: i, text: raw })
    bufferText.push(trimmed)
  }

  flush()

  return segments
}

function isNewsLabel(text: string): boolean {
  return /^[A-Z]{2,5}:$/.test(text)
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
