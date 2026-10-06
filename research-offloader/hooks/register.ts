import type { Register } from 'claude-code'

const TRIGGERS = [
  /\bresearch\b/,
  /\blook (it |this |that )?up\b/,
  /\bsummari[sz]e (this|that|the) (url|page|article|site|link|docs?)\b/,
  /\bcompare (the )?sources\b/,
  /\bread (this|that|the) (page|article|docs?)\b/,
  /\bwhat('s| is) the latest\b/,
  /\bsearch the web\b/,
]

export const isResearchPrompt = (text: string): boolean => {
  const lower = text.toLowerCase()

  return TRIGGERS.some(re => re.test(lower))
}

const delegateNote = (model: string) =>
  [
    '[research-offloader] This prompt is a research task. To keep the main context small:',
    `- Do the searching, fetching and reading inside one or more Agent subagents (model: "${model}"), not in this thread.`,
    '- Ask each subagent to return only a concise summary with source URLs, not raw page content.',
    '- Answer the user from those summaries.',
  ].join('\n')

export const register: Register = (on, options) => {
  const endpoint = String(options.endpoint ?? '').trim()
  const subagentModel = String(options.subagentModel ?? 'haiku') as 'haiku' | 'sonnet' | 'opus'
  // True while the current turn came from a research prompt.
  let isResearchTurn = false

  on('prompt.submit', async ($, e, next) => {
    isResearchTurn = e.origin.kind === 'composer' && isResearchPrompt(e.text)
    if (!isResearchTurn) return next(e)

    if (endpoint !== '') {
      $.ui.toast('research-offloader: asking your research endpoint…')
      const res = await $.http.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: e.text }),
      })
      let summary = ''
      if (res.ok) {
        try {
          summary = String((JSON.parse(res.text) as { summary?: unknown }).summary ?? '')
        } catch {
          summary = ''
        }
      }
      if (summary !== '') {
        const note = `[research-offloader] Research summary from ${endpoint}. Use it as your source; only research further if it is clearly insufficient.\n\n${summary}`

        return next({ ...e, context: [...(e.context ?? []), note] })
      }
      $.ui.toast(`research-offloader: endpoint gave no summary (HTTP ${res.status}); delegating to a subagent`)
    } else {
      $.ui.toast(`research-offloader: delegating research to a ${subagentModel} subagent`)
    }

    return next({ ...e, context: [...(e.context ?? []), delegateNote(subagentModel)] })
  })

  // During a research turn, subagents spawned without a model run on the cheap one.
  on('tool.call', { tool: 'Agent' }, ($, e, next) =>
    isResearchTurn && e.model === undefined && e.subagent_type !== 'fork'
      ? next({ ...e, model: subagentModel })
      : next(e),
  )

  on('turn.complete', ($, e, next) => {
    isResearchTurn = false

    return next(e)
  })
}
