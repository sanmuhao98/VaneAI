import { describe, expect, test } from 'vitest'
import { resolveProvider } from './index'

describe('resolveProvider', () => {
  test('fal + key → fal provider', () => {
    expect(resolveProvider('fal', 'some-key').name).toBe('fal')
  })
  test('fal + no key → mock fallback', () => {
    expect(resolveProvider('fal', undefined).name).toBe('mock')
  })
  test('mock → mock', () => {
    expect(resolveProvider('mock').name).toBe('mock')
  })
  test('unknown → throws', () => {
    expect(() => resolveProvider('nope')).toThrow(/unknown provider/)
  })
})
