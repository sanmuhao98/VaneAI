import { describe, expect, test } from 'vitest'
import { devCallLimitExceeded } from './dev-limit'

describe('devCallLimitExceeded', () => {
  test('no limit configured → never exceeded', () => {
    expect(devCallLimitExceeded(999, undefined)).toBe(false)
  })

  test('below limit → not exceeded', () => {
    expect(devCallLimitExceeded(19, 20)).toBe(false)
  })

  test('at limit → exceeded (the next call would be one too many)', () => {
    expect(devCallLimitExceeded(20, 20)).toBe(true)
  })

  test('limit 0 → always exceeded (hard off-switch)', () => {
    expect(devCallLimitExceeded(0, 0)).toBe(true)
  })
})
