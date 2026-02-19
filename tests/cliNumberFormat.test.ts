import { describe, expect, it } from 'vitest'

import { formatCliNumber } from '../src/cli/numberFormat'

describe('formatCliNumber', () => {
  it('formats index keys as integers', () => {
    expect(formatCliNumber('lineIndex', 21)).toBe('21')
    expect(formatCliNumber('tsLineIndex', 21)).toBe('21')
    expect(formatCliNumber('startTsIndex', 8)).toBe('8')
    expect(formatCliNumber('index', 3)).toBe('3')
  })

  it('keeps non-index numeric fields at one decimal place', () => {
    expect(formatCliNumber('cps', 17.25)).toBe('17.3')
    expect(formatCliNumber('gapFrames', 2)).toBe('2.0')
  })
})
