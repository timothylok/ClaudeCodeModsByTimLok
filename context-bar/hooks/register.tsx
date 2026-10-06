import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ContextBarSnapshot } from '../types'
import { formatTokens, glyph, layout } from './layout'

const isOn = atom({ plugin: 'context-bar', key: 'isOn' } as const, true)
const snapshot = atom({ plugin: 'context-bar', key: 'snapshot' } as const, null)

// "summary" estimates every category locally from the last response's usage,
// so a refresh sends no token-count requests (the "full" count /context runs
// does). Deferred tool schemas sit outside the window, as /context leaves
// them out of its grid.
async function refresh($: EngineInterface): Promise<void> {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const b = context.breakdown
  if (!b) return
  const next: ContextBarSnapshot = {
    categories: b.categories
      .filter(c => c.kind !== 'deferred')
      .map(c => ({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind as 'used' | 'free' | 'buffer' })),
    totalTokens: b.totalTokens,
    maxTokens: b.rawMaxTokens,
    percentage: b.percentage,
  }
  await update($, snapshot, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'context-bar',
      description: 'Show or hide the context-window bar above the prompt',
      immediate: true,
    })
    const result = await next(e)
    await refresh($)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)

    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    await refresh($)

    return result
  })

  on('command.run', { command: 'context-bar' }, async $ => {
    const shown = await update($, isOn, was => !was)
    if (shown) await refresh($)

    return { text: shown ? 'Context bar shown.' : 'Context bar hidden.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    if (e.props.hasSurvey || !(await read($, isOn)) || !snap) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const suffix = ` ${snap.percentage}% · ${formatTokens(snap.totalTokens)}/${formatTokens(snap.maxTokens)}`
    const width = Math.max(10, e.props.bodyColumns - suffix.length - 1)
    const segments = layout(snap.categories, snap.maxTokens, width)
    // Legend reads biggest share first; the bar keeps /context's order.
    const used = snap.categories
      .filter(c => c.kind === 'used' && c.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)

    // Other mods (e.g. usage-bar) draw in this band too; answering without
    // next() would replace them, so stack whatever sits beneath us.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          {segments.map(s => (
            <Text key={s.name} color={s.color} dimColor={s.kind !== 'used'}>
              {glyph(s.kind).repeat(s.cells)}
            </Text>
          ))}
          <Text dimColor>{suffix}</Text>
        </Text>
        <Text wrap="truncate-end">
          {used.map(c => (
            <Text key={c.name}>
              <Text color={c.color}>■</Text>
              <Text dimColor>
                {' '}
                {c.name} {formatTokens(c.tokens)}
                {'  '}
              </Text>
            </Text>
          ))}
        </Text>
        {below}
      </Box>
    )
  })
}
