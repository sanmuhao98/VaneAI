import { describe, expect, test } from 'vitest'
import { resolveProvider } from './index'

describe('resolveProvider', () => {
  test('seedream + ark key → seedream provider', () => {
    expect(resolveProvider('seedream', { ark: 'some-key' }).name).toBe('seedream')
  })
  test('seedream + no key → mock fallback', () => {
    expect(resolveProvider('seedream', {}).name).toBe('mock')
  })
  test('fal + key → fal provider', () => {
    expect(resolveProvider('fal', { fal: 'some-key' }).name).toBe('fal')
  })
  test('fal + no key → mock fallback', () => {
    expect(resolveProvider('fal', {}).name).toBe('mock')
  })
  test('mock → mock', () => {
    expect(resolveProvider('mock').name).toBe('mock')
  })
  test('unknown → throws', () => {
    expect(() => resolveProvider('nope')).toThrow(/unknown provider/)
  })
})
