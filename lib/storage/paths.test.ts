import { describe, expect, test } from 'vitest'
import { buildGenerationStoragePath } from './paths'

describe('buildGenerationStoragePath', () => {
  test('includes image index so multiple images of one job never collide', () => {
    const p0 = buildGenerationStoragePath('user-1', 'job-1', 0, 'image/png')
    const p1 = buildGenerationStoragePath('user-1', 'job-1', 1, 'image/png')
    expect(p0).toBe('user-1/job-1/image-0.png')
    expect(p1).toBe('user-1/job-1/image-1.png')
    expect(p0).not.toBe(p1)
  })

  test('maps mime type to extension', () => {
    expect(buildGenerationStoragePath('u', 'j', 0, 'image/svg+xml')).toBe('u/j/image-0.svg')
    expect(buildGenerationStoragePath('u', 'j', 0, 'image/webp')).toBe('u/j/image-0.webp')
    expect(buildGenerationStoragePath('u', 'j', 0, 'image/jpeg')).toBe('u/j/image-0.jpg')
    expect(buildGenerationStoragePath('u', 'j', 0, 'application/octet-stream')).toBe('u/j/image-0.jpg')
  })
})
