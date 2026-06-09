import { describe, expect, test } from 'vitest'
import { assemblePrompt } from './prompt'

describe('assemblePrompt', () => {
  test('replaces {subject} placeholder', () => {
    expect(assemblePrompt('concept art of {subject}, detailed', '女骑士'))
      .toBe('concept art of 女骑士, detailed')
  })
  test('replaces every {subject} occurrence', () => {
    expect(assemblePrompt('{subject} as a {subject} hero', 'cat'))
      .toBe('cat as a cat hero')
  })
  test('appends keyword when no placeholder', () => {
    expect(assemblePrompt('cyberpunk poster', '柴犬'))
      .toBe('cyberpunk poster, 柴犬')
  })
})
