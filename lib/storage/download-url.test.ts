import { describe, expect, test } from 'vitest'
import { withDownloadParam } from './download-url'

describe('withDownloadParam', () => {
  test('appends download param to a signed URL that already has a query', () => {
    const url = withDownloadParam('https://x.supabase.co/storage/v1/object/sign/g/a.png?token=abc')
    const u = new URL(url)
    expect(u.searchParams.get('token')).toBe('abc')
    expect(u.searchParams.has('download')).toBe(true)
  })

  test('works on a URL without a query string', () => {
    const url = withDownloadParam('https://x.supabase.co/storage/v1/object/public/t/b.png')
    const u = new URL(url)
    expect(u.searchParams.has('download')).toBe(true)
    expect(u.pathname).toBe('/storage/v1/object/public/t/b.png')
  })
})
