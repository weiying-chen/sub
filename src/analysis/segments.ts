import type { Metric } from './types'

import { type ParseBlockOptions, parseBlockAt } from '../shared/tsvRuns'

export type CandidateLine = {
  lineIndex: number
  lineText: string
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
  translation: string
  blockType?: 'vo' | 'super' | 'super_people'
  skipTranslation?: boolean
  marker?: NewsMarker
  superPerson?: SuperPersonEntry
  sourceText?: string
  tsIndex?: number
  translationIndex?: number
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
  let skipNextNonEmptyAfterUrl = false

  for (let i = 0; i < lines.length; i += 1) {
    const block = parseBlockAt(src, i, options)
    if (!block) continue
    const trimmedTranslation = block.translation.trim()

    if (isReferenceUrlLine(trimmedTranslation)) {
      skipNextNonEmptyAfterUrl = true
      continue
    }

    if (skipNextNonEmptyAfterUrl && trimmedTranslation !== '') {
      skipNextNonEmptyAfterUrl = false
      continue
    }

    const targetLines = isEnglishLikeLine(block.translation)
      ? [{ lineIndex: block.translationIndex, lineText: block.translation }]
      : []
    segments.push({
      lineIndex: block.translationIndex,
      lineIndexEnd: block.translationIndex,
      translation: block.translation,
      tsIndex: block.tsIndex,
      translationIndex: block.translationIndex,
      startFrames: block.startFrames,
      endFrames: block.endFrames,
      targetLines,
    })
  }

  return segments
}

export function parseText(text: string): Segment[] {
  const lines = text.split('\n')
  const segments: Segment[] = []
  let skipReferenceBlockAfterUrl = false

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? ''
    const trimmed = raw.trim()

    if (isReferenceUrlLine(trimmed)) {
      skipReferenceBlockAfterUrl = true
      continue
    }

    if (skipReferenceBlockAfterUrl) {
      if (trimmed === '') {
        skipReferenceBlockAfterUrl = false
      }
      continue
    }

    if (!isEnglishLikeLine(raw)) continue

    segments.push({
      lineIndex: i,
      lineIndexEnd: i,
      translation: raw,
      targetLines: [{ lineIndex: i, lineText: raw }],
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
  let currentSkipTranslation = false
  let currentMarker: NewsMarker | undefined
  let pendingVoMarker: NewsMarker | undefined
  let inComment = false
  let inSuperComment = false
  let inSuperPeopleSection = false
  let superPeopleBuffer: CandidateLine[] = []
  let superActive = false
  let skipNextNonEmptyAfterUrl = false

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
      translation: targetBuffer.map((line) => line.lineText.trim()).join(' '),
      sourceText: sourceBuffer.map((line) => line.lineText.trim()).join(' '),
      sourceLines: sourceBuffer,
      targetLines: targetBuffer,
      blockType: currentBlock,
      skipTranslation: currentSkipTranslation,
    })
    sourceBuffer = []
    targetBuffer = []
    currentBlock = null
    currentSkipTranslation = false
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
      translation: superPeopleBuffer.map((line) => line.lineText.trim()).join(' '),
      blockType: 'super_people',
      targetLines: [...superPeopleBuffer],
      superPerson: entry,
    })

    superPeopleBuffer = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (isReferenceUrlLine(trimmed)) {
      skipNextNonEmptyAfterUrl = true
      continue
    }

    if (skipNextNonEmptyAfterUrl && trimmed !== '') {
      skipNextNonEmptyAfterUrl = false
      continue
    }

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
        pendingVoMarker = parsedMarker
        continue
      }

      if (trimmed === '字幕：') {
        flushSuperPeople()
        inSuperPeopleSection = false
        continue
      }

      superPeopleBuffer.push({ lineIndex: i, lineText: raw })
      continue
    }

    const isSuperStart = trimmed.startsWith('/*SUPER')
    const isCommentStart = trimmed.startsWith('/*')
    const isCommentEnd = trimmed.includes('*/')

    if (isCommentStart) {
      flush()
      if (isSuperStart) {
        pendingVoMarker = undefined
      }
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
        sourceBuffer.push({ lineIndex: i, lineText: raw.trim() })
      }
      if (isCommentEnd) {
        inComment = false
        if (inSuperComment) superActive = true
        inSuperComment = false
      }
      continue
    }

    if (trimmed === '') {
      const hasSourceWithoutTarget =
        currentBlock != null && sourceBuffer.length > 0 && targetBuffer.length === 0
      if (hasSourceWithoutTarget) {
        const next = nextNonEmptyLine(lines, i + 1)
        if (next) {
          const nextIsTargetText =
            isEnglishLikeLine(next.raw) && !isNewsStructureLine(next.trimmed)
          const nextIsSourceParagraph =
            currentBlock === 'vo' && isNewsSourceLine(next.raw)
          const nextIsSuperSkipMarker =
            currentBlock === 'super' && next.trimmed === '~'
          if (nextIsTargetText || nextIsSourceParagraph || nextIsSuperSkipMarker) {
            continue
          }
        }
      }

      flush()
      superActive = false
      continue
    }

    if (isInlineNewsMarker(trimmed)) {
      continue
    }

    const parsedMarker = parseNewsMarker(trimmed, i)
    if (parsedMarker) {
      flush()
      pendingVoMarker = parsedMarker
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
        if (blockType === 'vo') {
          currentMarker = pendingVoMarker
          pendingVoMarker = undefined
        }
      }
      currentBlock = blockType
      targetBuffer.push({ lineIndex: i, lineText: raw })
      continue
    }

    if (isNewsSourceLine(raw)) {
      const blockType: Segment['blockType'] = superActive ? 'super' : 'vo'
      if (targetBuffer.length > 0 || (currentBlock && currentBlock !== blockType)) {
        flush()
      }

      if (!currentBlock) {
        if (blockType === 'vo') {
          currentMarker = pendingVoMarker
          pendingVoMarker = undefined
        }
      }
      currentBlock = blockType
      sourceBuffer.push({ lineIndex: i, lineText: raw.trim() })
      continue
    }

    if (
      trimmed === '~' &&
      currentBlock === 'super' &&
      sourceBuffer.length > 0 &&
      targetBuffer.length === 0
    ) {
      currentSkipTranslation = true
      flush()
      superActive = false
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
  const [zhLine, ...englishLines] = lines.map((line) => line.lineText.trim())
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

function isInlineNewsMarker(text: string): boolean {
  return /^NS:?$/i.test(text)
}

function isReferenceUrlLine(trimmed: string): boolean {
  return /^(https?:\/\/|www\.)\S+$/i.test(trimmed)
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

export function isEnglishLikeLine(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return false
  if (trimmed.startsWith('(') || trimmed.startsWith('[')) return false
  if (trimmed.startsWith('/*')) return false

  const cjkRe = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/
  if (cjkRe.test(text)) return false

  const letters = text.match(/[A-Za-z]/g)
  return (letters?.length ?? 0) >= 3
}

function nextNonEmptyLine(
  lines: string[],
  startIndex: number
): { raw: string; trimmed: string } | null {
  for (let i = startIndex; i < lines.length; i += 1) {
    const raw = lines[i] ?? ''
    const trimmed = raw.trim()
    if (trimmed === '') continue
    return { raw, trimmed }
  }

  return null
}
