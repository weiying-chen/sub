import type { Metric } from './types'

import { parseBlockAt } from '../shared/tsvRuns'

export type Segment = {
  lineIndex: number
  text: string
  tsIndex?: number
  payloadIndex?: number
  startFrames?: number
  endFrames?: number
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

  for (let i = 0; i < lines.length; i += 1) {
    const block = parseBlockAt(src, i)
    if (!block) continue
    segments.push({
      lineIndex: block.payloadIndex,
      text: block.payloadText,
      tsIndex: block.tsIndex,
      payloadIndex: block.payloadIndex,
      startFrames: block.startFrames,
      endFrames: block.endFrames,
    })
  }

  return segments
}

export function parseNews(text: string): Segment[] {
  const lines = text.split('\n')
  const segments: Segment[] = []

  let startIndex: number | null = null
  let buffer: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (trimmed === '') {
      if (buffer.length > 0 && startIndex != null) {
        segments.push({
          lineIndex: startIndex,
          text: buffer.join(' '),
        })
        buffer = []
        startIndex = null
      }
      continue
    }

    if (startIndex == null) startIndex = i
    buffer.push(trimmed)
  }

  if (buffer.length > 0 && startIndex != null) {
    segments.push({
      lineIndex: startIndex,
      text: buffer.join(' '),
    })
  }

  return segments
}
