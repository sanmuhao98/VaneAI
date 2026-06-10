import { describe, expect, test } from 'vitest'
import { toJobView } from './job-view'

const row = {
  id: 'j1',
  status: 'failed',
  type: 'text_to_image',
  template_id: 't1',
  input: { keyword: '柴犬', width: 1024, height: 1024, somethingInternal: 'x' },
  error: { code: 'provider_error', message: 'fal raw stack trace with internals' },
  created_at: '2026-06-10T00:00:00Z',
  finished_at: '2026-06-10T00:00:09Z',
}

describe('toJobView', () => {
  test('whitelists input fields and hides internal error message', () => {
    expect(toJobView(row)).toEqual({
      id: 'j1',
      status: 'failed',
      type: 'text_to_image',
      templateId: 't1',
      keyword: '柴犬',
      width: 1024,
      height: 1024,
      error: { code: 'provider_error', message: '生成失败，请重试' },
      createdAt: '2026-06-10T00:00:00Z',
      finishedAt: '2026-06-10T00:00:09Z',
    })
  })

  test('error null when absent', () => {
    expect(toJobView({ ...row, status: 'succeeded', error: null }).error).toBeNull()
  })

  test('never leaks a prompt field even if present in input (ADR-016)', () => {
    const leaky = { ...row, input: { ...row.input, prompt: 'SECRET base prompt' } }
    expect(JSON.stringify(toJobView(leaky))).not.toContain('SECRET')
  })
})
