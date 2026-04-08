#!/home/wei-ying-chen/node/sub/node_modules/.bin/tsx
import { appendFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fillSelectedTimestampLines } from '../shared/fillSubs'
import { parseFillSubsArgs } from './fillSubsCore'
import { loadAbbreviations } from './properNouns'

const CLIPBOARD_CMD_TIMEOUT_MS = Math.max(
  1,
  Number(process.env.CLIPBOARD_CMD_TIMEOUT_MS ?? 150)
)

// Optional: bypass clipboard (useful for reproducible tests)
const PARAGRAPH_FILE = process.env.PARAGRAPH_FILE ?? ''

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
  let r = spawnSync('wl-paste', ['-n'], {
    encoding: 'utf8',
    timeout: CLIPBOARD_CMD_TIMEOUT_MS,
  })
  if (r.status === 0 && r.stdout.trim()) return r.stdout

  // X11 fallback
  r = spawnSync('xclip', ['-o', '-selection', 'clipboard'], {
    encoding: 'utf8',
    timeout: CLIPBOARD_CMD_TIMEOUT_MS,
  })
  if (r.status === 0 && r.stdout.trim()) return r.stdout

  r = spawnSync('xsel', ['--clipboard', '--output'], {
    encoding: 'utf8',
    timeout: CLIPBOARD_CMD_TIMEOUT_MS,
  })
  if (r.status === 0 && r.stdout.trim()) return r.stdout

  // Windows fallback (PowerShell)
  r = spawnSync('pwsh', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], {
    encoding: 'utf8',
    timeout: CLIPBOARD_CMD_TIMEOUT_MS,
  })
  if (r.status === 0 && r.stdout.trim()) return r.stdout

  r = spawnSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], {
    encoding: 'utf8',
    timeout: CLIPBOARD_CMD_TIMEOUT_MS,
  })
  if (r.status === 0 && r.stdout.trim()) return r.stdout

  return ''
}

function setClipboardText(text: string): boolean {
  // Prefer Wayland
  let r = spawnSync('wl-copy', ['--trim-newline'], {
    input: text,
    encoding: 'utf8',
    timeout: CLIPBOARD_CMD_TIMEOUT_MS,
  })
  if (r.status === 0) return true

  // X11 fallback
  r = spawnSync('xclip', ['-selection', 'clipboard'], {
    input: text,
    encoding: 'utf8',
    timeout: CLIPBOARD_CMD_TIMEOUT_MS,
  })
  if (r.status === 0) return true

  r = spawnSync('xsel', ['--clipboard', '--input'], {
    input: text,
    encoding: 'utf8',
    timeout: CLIPBOARD_CMD_TIMEOUT_MS,
  })
  if (r.status === 0) return true

  // Windows fallback (PowerShell)
  r = spawnSync('pwsh', ['-NoProfile', '-Command', 'Set-Clipboard'], {
    input: text,
    encoding: 'utf8',
    timeout: CLIPBOARD_CMD_TIMEOUT_MS,
  })
  if (r.status === 0) return true

  r = spawnSync('powershell', ['-NoProfile', '-Command', 'Set-Clipboard'], {
    input: text,
    encoding: 'utf8',
    timeout: CLIPBOARD_CMD_TIMEOUT_MS,
  })
  return r.status === 0
}

function writeOverflowText(text: string): void {
  const message = `\nLeftover text (didn't fit in selected timestamps):\n${text}\n`

  try {
    appendFileSync('/dev/tty', message, { encoding: 'utf8' })
    return
  } catch {
    // No controlling TTY available (e.g., CI or non-interactive shell).
  }

  process.stderr.write(message)
}

const {
  inputFile,
  outputFile,
  altBreak,
  paragraphArg,
  maxChars,
  showOverflow,
  overflowToClipboard,
} = parseFillSubsArgs(
  process.argv.slice(2)
)
const LIMIT = Math.max(1, maxChars ?? 54)
const SHOW_OVERFLOW = showOverflow ?? false
const OVERFLOW_TO_CLIPBOARD = overflowToClipboard ?? false

const inputTsv = inputFile ? await readFile(inputFile, 'utf8') : await readStdin()
const hadTrailingNewline = /\r?\n$/.test(inputTsv)
const lines = inputTsv.split(/\r?\n/)
if (hadTrailingNewline) {
  // `split` keeps a trailing empty item for newline-terminated input.
  // Remove it so output newline count matches the original selection.
  lines.pop()
}

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
  {
    maxChars: LIMIT,
    inline: true,
    altBreak,
    noSplitAbbreviations: noSplitAbbreviations ?? undefined,
  }
)

const output = result.lines.join('\n') + (hadTrailingNewline ? '\n' : '')

if (outputFile) {
  await writeFile(outputFile, output)
} else {
  process.stdout.write(output)
}

const remaining = result.remaining.trim()
if (remaining && OVERFLOW_TO_CLIPBOARD) {
  setClipboardText(remaining)
}

if (remaining && SHOW_OVERFLOW) {
  writeOverflowText(remaining)
}
