import { describe, expect, test } from 'vitest'
import { mockProvider } from './mock'

describe('mockProvider', () => {
  test('returns one svg image with requested dimensions', async () => {
    const res = await mockProvider.generate({ prompt: 'secret base prompt', model: 'm', width: 512, height: 768 })
    expect(res.status).toBe('succeeded')
    expect(res.images).toHaveLength(1)
    expect(res.images[0].contentType).toBe('image/svg+xml')
    expect(res.images[0].width).toBe(512)
    expect(res.images[0].height).toBe(768)
    expect(res.images[0].bytes).toBeInstanceOf(Uint8Array)
  })

  test('output svg never embeds the prompt text (ADR-016)', async () => {
    const res = await mockProvider.generate({ prompt: 'TOP_SECRET_PROMPT', model: 'm' })
    const svg = new TextDecoder().decode(res.images[0].bytes!)
    expect(svg).not.toContain('TOP_SECRET_PROMPT')
  })
})
