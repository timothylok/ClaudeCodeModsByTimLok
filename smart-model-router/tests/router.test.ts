import { expect, test } from 'claude-code/testing'

import { isHeavyPrompt } from '../hooks/register'

test('architecture and deep-reasoning prompts route heavy', async () => {
  expect(isHeavyPrompt('Design the architecture for a multi-tenant billing service')).toBe(true)
  expect(isHeavyPrompt('Plan out a migration from REST to gRPC, with the trade-offs')).toBe(true)
  expect(isHeavyPrompt('Find the root cause of this flaky test')).toBe(true)
})

test('everyday prompts route light', async () => {
  expect(isHeavyPrompt('fix the typo in README')).toBe(false)
  expect(isHeavyPrompt('write a unit test for parseDate')).toBe(false)
  expect(isHeavyPrompt('rename foo to bar in utils.ts')).toBe(false)
})
