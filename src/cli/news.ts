import type { Reporter } from './watch'

export function createNewsReporter(): Reporter {
  return async (path, { clearScreen }) => {
    clearScreen()
    console.log(`NEWS format checks not implemented yet for: ${path}`)
  }
}
