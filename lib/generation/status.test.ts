import { describe, expect, test } from 'vitest'
import { canCancel, canRetry, isTerminal } from './status'

describe('job status rules', () => {
  test('canCancel only for pending/running', () => {
    expect(canCancel('pending')).toBe(true)
    expect(canCancel('running')).toBe(true)
    expect(canCancel('succeeded')).toBe(false)
    expect(canCancel('failed')).toBe(false)
    expect(canCancel('canceled')).toBe(false)
  })
  test('canRetry only for failed/canceled', () => {
    expect(canRetry('failed')).toBe(true)
    expect(canRetry('canceled')).toBe(true)
    expect(canRetry('pending')).toBe(false)
    expect(canRetry('succeeded')).toBe(false)
  })
  test('isTerminal for succeeded/failed/canceled', () => {
    expect(isTerminal('succeeded')).toBe(true)
    expect(isTerminal('failed')).toBe(true)
    expect(isTerminal('canceled')).toBe(true)
    expect(isTerminal('running')).toBe(false)
    expect(isTerminal('pending')).toBe(false)
  })
})
