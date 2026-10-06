import { expect, mock, test } from 'claude-code/testing'

import { colorFor, meter } from '../hooks/register'

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
  title: '',
}

test('meter fills in proportion', async () => {
  expect(meter(0)).toBe('░░░░░░░░░░')
  expect(meter(50)).toBe('█████░░░░░')
  expect(meter(120)).toBe('██████████')
})

test('colour steps up with usage', async () => {
  expect(colorFor(10)).toBe('success')
  expect(colorFor(75)).toBe('warning')
  expect(colorFor(95)).toBe('error')
})

test('the band shows the measured windows and warns past 80%', async ($, on) => {
  const toasts: string[] = []
  mock.clock(on, { now: Date.parse('2026-10-06T12:00:00Z') })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)

    return null as never
  })
  await $.session.measure({
    context: { window: 200000 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 42, resetsAt: '2026-10-06T14:30:00Z' },
      { kind: 'seven_day', percentUsed: 91 },
    ],
    changed: ['rateLimits'],
  })
  expect(toasts).toEqual(['Claude week usage at 91%'])
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'usage-bar',
      surface,
      component: 'AbovePrompt',
      props: BAND,
      viewport: { columns: 120, rows: 40 },
    })
    expect(await ui.find({ type: 'Text', text: /42%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2h30m/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /91%/ })).toBeDefined()
    await ui.unmount()
  }
})
