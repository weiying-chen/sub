import chokidar from 'chokidar'

import { createNewsReporter } from './news'
import { createSubsReporter } from './subs'
import { parseArgs } from './watchArgs'

export type Reporter = (
  path: string,
  helpers: { clearScreen: () => void }
) => Promise<void>

type WatchOptions = {
  label?: string
}

// Parse CLI args once
// Usage: watch <file> [--type subs|news] [--no-warn] [--baseline path] [--ignore-empty-lines]
const args = process.argv.slice(2)
const { filePath, type, showWarnings, baselinePath, ignoreEmptyLines } = parseArgs(args)

function debounce<TArgs extends any[]>(
  fn: (...args: TArgs) => void | Promise<void>,
  ms: number
) {
  let t: NodeJS.Timeout | null = null

  return (...args: TArgs) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      t = null
      void fn(...args)
    }, ms)
  }
}

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H')
}


export async function watch(
  path: string,
  reporter: Reporter,
  options: WatchOptions = {}
) {
  // Lint once immediately
  try {
    await reporter(path, { clearScreen })
  } catch (err) {
    clearScreen()
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`ERROR ${msg}`)
  }

  // Then watch and re-run on changes
  const run = debounce(async () => {
    try {
      await reporter(path, { clearScreen })
    } catch (err) {
      clearScreen()
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`ERROR ${msg}`)
    }
  }, 200)

  const watcher = chokidar.watch(path, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 80,
      pollInterval: 20,
    },
  })

  watcher.on('change', run)
  watcher.on('error', (err) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`WATCHER_ERROR ${msg}`)
  })

  const label = options.label ? ` ${options.label}` : ''
  console.log(`watching ${path}${label}`)
}

// --- CLI entry ---

if (!filePath) {
  console.error('Usage: watch <file> [--type subs|news] [--no-warn] [--baseline path] [--ignore-empty-lines]')
  process.exit(1)
}

const normalizedType = type.trim().toLowerCase()

if (normalizedType !== 'subs' && normalizedType !== 'news') {
  console.error('Usage: watch <file> [--type subs|news] [--no-warn] [--baseline path] [--ignore-empty-lines]')
  process.exit(1)
}

if (normalizedType === 'news' && baselinePath) {
  console.warn('WARN --baseline is only supported with --type subs; ignoring.')
}

const reporter =
  normalizedType === 'news'
    ? createNewsReporter()
    : createSubsReporter({
        showWarnings,
        baselinePath: baselinePath ?? undefined,
        ignoreEmptyLines,
      })

const label =
  normalizedType === 'news' ? '(news)' : '(subs)'

void watch(filePath, reporter, { label })
