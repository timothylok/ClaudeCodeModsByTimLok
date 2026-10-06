import { expect, test } from 'claude-code/testing'

import { isResearchPrompt } from '../hooks/register'

test('research prompts are spotted', async () => {
  expect(isResearchPrompt('Research the best Rust ORMs in 2026')).toBe(true)
  expect(isResearchPrompt('Can you look up how Vite handles HMR?')).toBe(true)
  expect(isResearchPrompt('summarize this page for me: https://example.com')).toBe(true)
  expect(isResearchPrompt('compare sources on WebGPU support')).toBe(true)
})

test('coding prompts are left alone', async () => {
  expect(isResearchPrompt('fix the failing test in auth.ts')).toBe(false)
  expect(isResearchPrompt('add a --verbose flag to the CLI')).toBe(false)
})
