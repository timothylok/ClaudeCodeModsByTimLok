import { describe, expect, test } from 'claude-code/testing'

import type { ContextBarCategory } from '../types'
import { formatTokens, layout } from './layout'

const cat = (name: string, tokens: number, kind: ContextBarCategory['kind'] = 'used'): ContextBarCategory => ({
  name,
  tokens,
  color: name,
  kind,
})

describe('layout', () => {
  test('cells always sum to the width and follow /context order', () => {
    const rows = [cat('System prompt', 3000), cat('Tools', 17000), cat('Messages', 40000),
      cat('Autocompact buffer', 33000, 'buffer'), cat('Free space', 107000, 'free')]
    for (const width of [10, 37, 80, 151]) {
      const segs = layout(rows, 200000, width)
      expect(segs.reduce((n, s) => n + s.cells, 0)).toBe(width)
      expect(segs.map(s => s.name)).toEqual(rows.map(r => r.name))
    }
  })

  test('a tiny used category keeps one cell, taken from free space', () => {
    const rows = [cat('Memory files', 200), cat('Messages', 50000), cat('Free space', 149800, 'free')]
    const segs = layout(rows, 200000, 40)
    expect(segs.find(s => s.name === 'Memory files')?.cells).toBe(1)
    expect(segs.reduce((n, s) => n + s.cells, 0)).toBe(40)
  })

  test('proportions match the token shares', () => {
    const segs = layout([cat('Messages', 50000), cat('Free space', 150000, 'free')], 200000, 100)
    expect(segs.map(s => s.cells)).toEqual([25, 75])
  })

  test('an over-full window scales to the total instead of overflowing', () => {
    const segs = layout([cat('Messages', 300000)], 200000, 50)
    expect(segs).toEqual([{ name: 'Messages', color: 'Messages', kind: 'used', cells: 50 }])
  })

  test('zero-token rows and empty input draw nothing', () => {
    expect(layout([cat('Messages', 0)], 200000, 40)).toEqual([])
    expect(layout([], 200000, 40)).toEqual([])
  })
})

test('formatTokens', () => {
  expect(formatTokens(950)).toBe('950')
  expect(formatTokens(3100)).toBe('3.1k')
  expect(formatTokens(84000)).toBe('84k')
  expect(formatTokens(1_000_000)).toBe('1.0M')
})
