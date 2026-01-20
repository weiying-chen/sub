import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROPER_NOUNS_FILE = 'punctuation-proper-nouns.txt'
const CAPITALIZATION_TERMS_FILE = 'capitalization-terms.txt'

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

export async function loadCapitalizationTerms(): Promise<string[] | null> {
  return loadTextList(CAPITALIZATION_TERMS_FILE)
}
