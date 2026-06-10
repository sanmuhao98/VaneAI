import { describe, expect, test } from 'vitest'
import { mapSeedreamSize } from './seedream-size'

// Seedream pixel sizes must satisfy total pixels ∈ [3686400, 16777216] — our
// templates' 1024x1024 is BELOW the floor, so requested dims map to the closest
// officially recommended 2K size by aspect ratio.
describe('mapSeedreamSize', () => {
  test('1:1 → 2048x2048', () => {
    expect(mapSeedreamSize(1024, 1024)).toEqual({ size: '2048x2048', width: 2048, height: 2048 })
  })

  test('portrait 3:4 → 1728x2304', () => {
    expect(mapSeedreamSize(768, 1024)).toEqual({ size: '1728x2304', width: 1728, height: 2304 })
  })

  test('landscape 16:9 → 2848x1600', () => {
    expect(mapSeedreamSize(1920, 1080)).toEqual({ size: '2848x1600', width: 2848, height: 1600 })
  })

  test('near-square leans to 1:1', () => {
    expect(mapSeedreamSize(1000, 1024).size).toBe('2048x2048')
  })

  test('undefined dims default to 1:1', () => {
    expect(mapSeedreamSize(undefined, undefined).size).toBe('2048x2048')
  })

  test('extreme ratio clamps to the widest supported preset (21:9)', () => {
    expect(mapSeedreamSize(4000, 1000).size).toBe('3136x1344')
  })
})
