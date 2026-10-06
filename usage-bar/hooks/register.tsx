import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { UsageWindow } from '../types'

const windows = atom({ plugin: 'usage-bar', key: 'windows' } as const, [])
const isHidden = atom({ plugin: 'usage-bar', key: 'isHidden' } as const, false)

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: 'week', spend_limit: 'spend' }
const WARN_AT = [80, 95]

export const meter = (pct: number, width = 10): string => {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export const colorFor = (pct: number) => (pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success')

const resetsIn = (iso: string | undefined, now: number): string => {
  if (iso === undefined) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))

  return mins >= 60 * 24 ? ` ${Math.round(mins / 60 / 24)}d` : mins >= 60 ? ` ${Math.floor(mins / 60)}h${mins % 60}m` : ` ${mins}m`
}

export const register: Register = on => {
  // Highest warning threshold already toasted per window, so each fires once.
  const warned: Record<string, number> = {}

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'usage-bar', description: 'Show or hide the usage band' })
    const { rateLimits } = await $.session.usage()
    await update($, windows, () => rateLimits)

    return next(e)
  })

  on('command.run', { command: 'usage-bar' }, async $ => {
    const hidden = await update($, isHidden, v => !v)

    return { text: hidden ? 'Usage band hidden.' : 'Usage band shown.' }
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, windows, () => e.rateLimits)
      for (const w of e.rateLimits) {
        const crossed = WARN_AT.filter(t => w.percentUsed >= t).pop()
        if (crossed !== undefined && (warned[w.kind] ?? 0) < crossed) {
          warned[w.kind] = crossed
          $.ui.toast(`Claude ${LABELS[w.kind] ?? w.kind} usage at ${w.percentUsed}%`)
        }
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list: UsageWindow[] = await read($, windows)
    if (e.props.hasSurvey || list.length === 0 || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    // Other mods (e.g. context-bar) draw in this band too; answering without
    // next() would replace them, so stack whatever sits beneath us.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>Usage </Text>
          {list.map(w => (
            <Text key={w.kind}>
              <Text dimColor>{LABELS[w.kind] ?? w.kind} </Text>
              <Text color={colorFor(w.percentUsed)}>
                {meter(w.percentUsed)} {w.percentUsed}%
              </Text>
              <Text dimColor>{resetsIn(w.resetsAt, now)}   </Text>
            </Text>
          ))}
        </Box>
        {below}
      </Box>
    )
  })
}
