// Scaffold smoke test — verifies the test runner is wired up.
// Real property tests are added in task 2.
import { describe, it, expect } from 'vitest'

describe('scaffold', () => {
  it('test runner is working', () => {
    expect(1 + 1).toBe(2)
  })
})
