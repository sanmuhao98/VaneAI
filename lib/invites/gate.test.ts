import { describe, expect, test } from 'vitest'

import { inviteGateBlocks } from './gate'

describe('inviteGateBlocks', () => {
  const activated = '2026-06-11T00:00:00Z'

  test('gate off → never blocks', () => {
    expect(inviteGateBlocks('0', null, false)).toBe(false)
    expect(inviteGateBlocks('0', null, true)).toBe(false)
    expect(inviteGateBlocks(undefined, null, false)).toBe(false)
  })

  test('gate on + not activated + not admin → blocks', () => {
    expect(inviteGateBlocks('1', null, false)).toBe(true)
  })

  test('gate on + activated → passes', () => {
    expect(inviteGateBlocks('1', activated, false)).toBe(false)
  })

  test('gate on + admin → bypasses even without activation', () => {
    expect(inviteGateBlocks('1', null, true)).toBe(false)
  })
})
