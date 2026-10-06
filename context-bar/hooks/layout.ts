import type { ContextBarCategory } from '../types'

export type Segment = { name: string; color: string; kind: ContextBarCategory['kind']; cells: number }

const GLYPH: Record<ContextBarCategory['kind'], string> = { used: '█', buffer: '▒', free: '░' }

export const glyph = (kind: ContextBarCategory['kind']) => GLYPH[kind]

/**
 * Splits `width` cells across the categories in proportion to their tokens
 * (largest remainder, so the cells always sum to `width`). A used category
 * with any tokens keeps at least one cell, taken from the widest
 * non-used segment, so a small row like Memory files never vanishes.
 */
export function layout(categories: ContextBarCategory[], maxTokens: number, width: number): Segment[] {
  const rows = categories.filter(c => c.tokens > 0)
  const total = Math.max(maxTokens, rows.reduce((sum, c) => sum + c.tokens, 0))
  if (width <= 0 || total <= 0 || rows.length === 0) return []

  const segs = rows.map(c => {
    const exact = (c.tokens / total) * width
    return { name: c.name, color: c.color, kind: c.kind, cells: Math.floor(exact), rest: exact - Math.floor(exact) }
  })
  let left = width - segs.reduce((n, s) => n + s.cells, 0)
  for (const s of [...segs].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break
    s.cells += 1
    left -= 1
  }

  const widest = (pick: (s: (typeof segs)[number]) => boolean) =>
    segs.filter(s => pick(s) && s.cells > 1).sort((a, b) => b.cells - a.cells)[0]
  for (const s of segs) {
    if (s.kind !== 'used' || s.cells > 0) continue
    const donor = widest(d => d.kind !== 'used') ?? widest(() => true)
    if (donor) {
      donor.cells -= 1
      s.cells = 1
    }
  }

  return segs
    .filter(s => s.cells > 0)
    .map(({ name, color, kind, cells }) => ({ name, color, kind, cells }))
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}
