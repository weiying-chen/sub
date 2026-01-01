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

  let startIndex: number | null = null
  let endIndex: number | null = null
  let buffer: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (trimmed === '') {
      if (buffer.length > 0 && startIndex != null) {
        segments.push({
          lineIndex: startIndex,
          lineIndexEnd: endIndex ?? startIndex,
          text: buffer.join(' '),
          candidateLines: getCandidateLines(lines, startIndex, endIndex),
        })
        buffer = []
        startIndex = null
        endIndex = null
      }
      continue
    }

    if (startIndex == null) startIndex = i
    endIndex = i
    buffer.push(trimmed)
  }

  if (buffer.length > 0 && startIndex != null) {
    segments.push({
      lineIndex: startIndex,
      lineIndexEnd: endIndex ?? startIndex,
      text: buffer.join(' '),
      candidateLines: getCandidateLines(lines, startIndex, endIndex),
    })
  }

  return segments
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

function getCandidateLines(
  lines: string[],
  startIndex: number,
  endIndex: number | null
): CandidateLine[] {
  if (endIndex == null) return []
  const candidates: CandidateLine[] = []

  for (let i = startIndex; i <= endIndex; i += 1) {
    const line = lines[i] ?? ''
    if (!isEnglishLikeLine(line)) continue
    candidates.push({ lineIndex: i, text: line })
  }

  return candidates
}
