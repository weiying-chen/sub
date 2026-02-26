#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fillSelectedTimestampLines } from '../shared/fillSubs'
import { parseFillSubsArgs } from './fillSubsCore'
import { loadAbbreviations } from './properNouns'

const MAX_LEN = Number(process.env.MAX_LEN ?? process.env.MAX_CHARS ?? 54)
const LIMIT = Math.max(1, MAX_LEN)

// Optional: bypass clipboard (useful for reproducible tests)
const PARAGRAPH_FILE = process.env.PARAGRAPH_FILE ?? ''

// Default: allow partial fill (editor-friendly). Overflow is silently ignored.
// Opt in to printing leftover text with SHOW_OVERFLOW=1 (note: Helix pipe will paste stderr too).
const SHOW_OVERFLOW = process.env.SHOW_OVERFLOW === '1'

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
  })
}

function getClipboardText(): string {
  // Prefer Wayland
  let r = spawnSync('wl-paste', ['-n'], { encoding: 'utf8' })
  if (r.status === 0 && r.stdout.trim()) return r.stdout

  // X11 fallback
  r = spawnSync('xclip', ['-o', '-selection', 'clipboard'], { encoding: 'utf8' })
  if (r.status === 0 && r.stdout.trim()) return r.stdout

  r = spawnSync('xsel', ['--clipboard', '--output'], { encoding: 'utf8' })
  if (r.status === 0 && r.stdout.trim()) return r.stdout

  // Windows fallback (PowerShell)
  r = spawnSync('pwsh', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], {
    encoding: 'utf8',
  })
  if (r.status === 0 && r.stdout.trim()) return r.stdout

  r = spawnSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], {
    encoding: 'utf8',
  })
  if (r.status === 0 && r.stdout.trim()) return r.stdout

  return ''
}

const { inputFile, outputFile, inline, paragraphArg } = parseFillSubsArgs(
  process.argv.slice(2)
)

const inputTsv = inputFile ? await readFile(inputFile, 'utf8') : await readStdin()
const lines = inputTsv.split(/\r?\n/)

let paragraph = paragraphArg
if (!paragraph.trim()) {
  if (PARAGRAPH_FILE) {
    paragraph = await readFile(PARAGRAPH_FILE, 'utf8')
  } else {
    paragraph = getClipboardText()
  }
}

if (!paragraph.trim()) {
  const fallbackOutput = inputTsv
  process.stderr.write(
    'No paragraph found. Copy your English paragraph to clipboard (wl-paste/xclip/xsel), then run again.\n'
  )
  if (outputFile) {
    await writeFile(outputFile, fallbackOutput)
  } else {
    process.stdout.write(fallbackOutput)
  }
  process.exit(0)
}

const selectedLineIndices = new Set<number>()
for (let i = 0; i < lines.length; i++) {
  selectedLineIndices.add(i)
}

const noSplitAbbreviations = await loadAbbreviations()

const result = fillSelectedTimestampLines(
  lines,
  selectedLineIndices,
  paragraph,
  { maxChars: LIMIT, inline, noSplitAbbreviations: noSplitAbbreviations ?? undefined }
)

const output = result.lines.join('\n') + '\n'

if (outputFile) {
  await writeFile(outputFile, output)
} else {
  process.stdout.write(output)
}

if (result.remaining.trim() && SHOW_OVERFLOW) {
  process.stderr.write('\nLeftover text (didn\'t fit in selected timestamps):\n')
  process.stderr.write(result.remaining.trim() + '\n')
}
