import { describe, expect, it } from 'vitest'
import { isAnalyticsEvent, isClientAnalyticsEvent } from './events'

describe('isAnalyticsEvent', () => {
  it('accepts known server + client events', () => {
    expect(isAnalyticsEvent('signup')).toBe(true)
    expect(isAnalyticsEvent('generation_created')).toBe(true)
    expect(isAnalyticsEvent('replicate_again')).toBe(true)
  })

  it('rejects unknown names and non-strings', () => {
    expect(isAnalyticsEvent('drop_table')).toBe(false)
    expect(isAnalyticsEvent('')).toBe(false)
    expect(isAnalyticsEvent(undefined)).toBe(false)
    expect(isAnalyticsEvent(42)).toBe(false)
  })
})

describe('isClientAnalyticsEvent', () => {
  it('accepts only the client-reportable subset', () => {
    expect(isClientAnalyticsEvent('replicate_again')).toBe(true)
  })

  it('rejects server-only events (no client spoofing)', () => {
    // signup / generation_* are authoritative server events — the beacon must not accept them.
    expect(isClientAnalyticsEvent('signup')).toBe(false)
    expect(isClientAnalyticsEvent('generation_succeeded')).toBe(false)
    expect(isClientAnalyticsEvent('whatever')).toBe(false)
  })
})
