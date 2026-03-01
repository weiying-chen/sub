import type { Metric } from './types'

import { type ParseBlockOptions, parseBlockAt } from '../shared/tsvRuns'

export type CandidateLine = {
  lineIndex: number
  text: string
}

export type Segment = {
  lineIndex: number
  lineIndexEnd?: number
  text: string
  blockType?: 'vo' | 'super'
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
  let inComment = false
  let inSuperComment = false
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
      text: targetBuffer.map((line) => line.text.trim()).join(' '),
      sourceText: sourceBuffer.map((line) => line.text.trim()).join(' '),
      sourceLines: sourceBuffer,
      targetLines: targetBuffer,
      blockType: currentBlock,
    })
    sourceBuffer = []
    targetBuffer = []
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

    if (trimmed === '' || isNewsStructureLine(trimmed)) {
      flush()
      superActive = false
      continue
    }

    if (isEnglishLikeLine(raw)) {
      const blockType: Segment['blockType'] = superActive ? 'super' : 'vo'
      if (currentBlock && currentBlock !== blockType) {
        flush()
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

  flush()

  return segments
}

function isNewsLabel(text: string): boolean {
  return /^[A-Z]{2,5}:$/.test(text)
}

function isNewsStructureLine(text: string): boolean {
  if (isNewsLabel(text)) return true
  if (/^\d+_\d+$/.test(text)) return true
  if (/^[<>]+$/.test(text)) return true
  return false
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
