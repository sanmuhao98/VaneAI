import { describe, expect, test } from 'vitest'
import { isAdminEmail } from './admin-allowlist'

describe('isAdminEmail', () => {
  test('matches an email in the CSV allowlist', () => {
    expect(isAdminEmail('a@x.com', 'a@x.com,b@y.com')).toBe(true)
    expect(isAdminEmail('b@y.com', 'a@x.com, b@y.com')).toBe(true)
  })

  test('rejects emails not in the list', () => {
    expect(isAdminEmail('evil@x.com', 'a@x.com,b@y.com')).toBe(false)
  })

  test('case-insensitive and whitespace-tolerant', () => {
    expect(isAdminEmail('A@X.com', ' a@x.com ,b@y.com')).toBe(true)
  })

  test('empty / undefined allowlist or email → never admin', () => {
    expect(isAdminEmail('a@x.com', '')).toBe(false)
    expect(isAdminEmail('a@x.com', undefined)).toBe(false)
    expect(isAdminEmail(undefined, 'a@x.com')).toBe(false)
  })

  test('empty entries in CSV cannot match empty email', () => {
    expect(isAdminEmail('', 'a@x.com,,b@y.com')).toBe(false)
  })
})
