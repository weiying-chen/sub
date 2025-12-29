import chokidar from 'chokidar'

import { createNewsReporter } from './news'
import { createSubsReporter } from './subs'

export type Reporter = (
  path: string,
  helpers: { clearScreen: () => void }
) => Promise<void>

type WatchOptions = {
  label?: string
}

// Parse CLI args once
// Usage: watch <file> [--type subs|news] [--balance]
const args = process.argv.slice(2)
const { filePath, type, includeBalance } = parseArgs(args)

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

function parseArgs(argv: string[]) {
  const positionals: string[] = []
  let type = 'subs'
  let includeBalance = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--balance') {
      includeBalance = true
      continue
    }

    if (arg === '--type') {
      const next = argv[i + 1]
      if (next) {
        type = next
        i += 1
        continue
      }
    }

    if (arg.startsWith('--type=')) {
      type = arg.slice('--type='.length)
      continue
    }

    if (arg.startsWith('-')) continue
    positionals.push(arg)
  }

  return { filePath: positionals[0], type, includeBalance }
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
  console.error('Usage: watch <file> [--type subs|news] [--balance]')
  process.exit(1)
}

const normalizedType = type.trim().toLowerCase()

if (normalizedType !== 'subs' && normalizedType !== 'news') {
  console.error('Usage: watch <file> [--type subs|news] [--balance]')
  process.exit(1)
}

const reporter =
  normalizedType === 'news'
    ? createNewsReporter()
    : createSubsReporter({ includeBalance })

const label =
  normalizedType === 'news'
    ? '(news)'
    : includeBalance
      ? '(subs + CPS_BALANCE)'
      : '(subs)'

void watch(filePath, reporter, { label })
