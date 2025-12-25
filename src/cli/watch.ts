import chokidar from 'chokidar'
import { readFile } from 'node:fs/promises'

function nowTime() {
  return new Date().toISOString().slice(11, 19) // HH:MM:SS
}

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

async function printFileStats(filePath: string) {
  const text = await readFile(filePath, 'utf8')

  const len = text.length
  const lines = text === '' ? 0 : text.split(/\r?\n/).length

  console.log(`[${nowTime()}] LEN ${len}  LINES ${lines}`)
}

export async function watch(filePath: string) {
  const run = debounce(async () => {
    try {
      await printFileStats(filePath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[${nowTime()}] ERROR ${msg}`)
    }
  }, 200)

  const watcher = chokidar.watch(filePath, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 80,
      pollInterval: 20,
    },
  })

  watcher.on('change', run)
  watcher.on('error', (err) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[${nowTime()}] WATCHER_ERROR ${msg}`)
  })

  console.log(`[${nowTime()}] watching ${filePath}`)
}

// --- CLI entry ---

const filePath = process.argv[2]

if (!filePath) {
  console.error('Usage: watch <file>')
  process.exit(1)
}

void watch(filePath)
