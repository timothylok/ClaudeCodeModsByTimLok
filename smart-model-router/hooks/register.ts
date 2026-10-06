import type { Register } from 'claude-code'

type Mode = 'auto' | 'heavy' | 'light' | 'off'

const HEAVY = [
  /\barchitect(ure|ing)?\b/,
  /\bdesign (a|the) (system|service|api|schema)\b/,
  /\bmulti[- ]file\b/,
  /\brefactor (everything|the (whole|entire))\b/,
  /\b(re)?write the (whole|entire)\b/,
  /\bdeep(ly)? (reason|think|dive)\b/,
  /\btrade-?offs?\b/,
  /\bmigrat(e|ion) (from|to|the)\b/,
  /\broot cause\b/,
  /\b(plan|blueprint) (for|out)\b/,
]

export const isHeavyPrompt = (text: string): boolean => {
  const lower = text.toLowerCase()

  return HEAVY.some(re => re.test(lower)) || lower.length > 2500
}

export const register: Register = (on, options) => {
  const heavyModel = String(options.heavyModel ?? 'claude-opus-5-5')
  const lightModel = String(options.lightModel ?? 'claude-sonnet-5-5')
  const usageGuard = Number(options.usageGuard ?? 85)

  let mode: Mode = 'auto'
  // The model this turn's main-thread steps go to; null leaves the session's own.
  let turnModel: string | null = null

  on('session.start', async ($, e, next) => {
    const stored = await $.store.get('mode')
    if (stored === 'auto' || stored === 'heavy' || stored === 'light' || stored === 'off') mode = stored
    await $.command.register({
      name: 'route',
      description: 'Model router: /route auto | heavy | light | off',
    })

    return next(e)
  })

  on('command.run', { command: 'route' }, async ($, e) => {
    const want = e.args.trim().toLowerCase()
    if (want !== 'auto' && want !== 'heavy' && want !== 'light' && want !== 'off') {
      return { text: `Router mode is "${mode}". Use /route auto | heavy | light | off.` }
    }
    mode = want
    await $.store.set('mode', mode)
    if (mode === 'off') $.ui.status(undefined)

    return { text: `Router mode set to "${mode}".` }
  })

  on('prompt.submit', async ($, e, next) => {
    if (mode === 'off') {
      turnModel = null

      return next(e)
    }

    const { rateLimits } = await $.session.usage()
    const peak = Math.max(0, ...rateLimits.map(r => r.percentUsed))
    let why: string

    if (peak >= usageGuard) {
      turnModel = lightModel
      why = `usage ${peak}%`
    } else if (mode === 'heavy' || mode === 'light') {
      turnModel = mode === 'heavy' ? heavyModel : lightModel
      why = 'forced'
    } else {
      const heavy = isHeavyPrompt(e.text)
      turnModel = heavy ? heavyModel : lightModel
      why = heavy ? 'complex prompt' : 'routine prompt'
    }
    $.ui.status(`router: ${turnModel} (${why})`)

    return next(e)
  })

  // Every model request of the main thread in this turn goes to the chosen model;
  // subagents keep whatever model they were spawned with.
  on('turn.step', async function* ($, e, next) {
    if (turnModel === null || e.agentId !== undefined || e.model === turnModel) {
      return yield* next(e)
    }

    return yield* next({ ...e, model: turnModel })
  })
}
