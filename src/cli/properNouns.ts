import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROPER_NOUNS_FILE = 'punctuation-proper-nouns.txt'
const ABBREVIATIONS_FILE = 'punctuation-abbreviations.txt'
const CAPITALIZATION_TERMS_FILE = 'capitalization-terms.txt'
const TERM_VARIANTS_FILE = 'term-variants.txt'

export type TermVariantEntry = {
  variant: string
  canonical: string
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate)
    return true
  } catch {
    return false
  }
}

async function findUp(filename: string, startDir: string): Promise<string | null> {
  let dir = startDir
  while (true) {
    const candidate = path.join(dir, filename)
    if (await pathExists(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

async function loadTextList(filename: string): Promise<string[] | null> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const roots = [process.cwd(), moduleDir]

  for (const root of roots) {
    const found = await findUp(filename, root)
    if (!found) continue
    try {
      const raw = await readFile(found, 'utf8')
      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'))
    } catch {
      return null
    }
  }

  return null
}

export async function loadProperNouns(): Promise<string[] | null> {
  return loadTextList(PROPER_NOUNS_FILE)
}

export async function loadAbbreviations(): Promise<string[] | null> {
  return loadTextList(ABBREVIATIONS_FILE)
}

export async function loadCapitalizationTerms(): Promise<string[] | null> {
  return loadTextList(CAPITALIZATION_TERMS_FILE)
}

export async function loadTermVariants(): Promise<TermVariantEntry[] | null> {
  const lines = await loadTextList(TERM_VARIANTS_FILE)
  if (!lines) return null

  const out: TermVariantEntry[] = []
  for (const line of lines) {
    const [left, right] = line.split(/\s*=>\s*/, 2)
    const variant = left?.trim() ?? ''
    const canonical = right?.trim() ?? ''
    if (!variant || !canonical) continue
    out.push({ variant, canonical })
  }
  return out
}
