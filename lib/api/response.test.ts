import { describe, expect, test } from 'vitest'
import { apiOk, apiFail } from './response'

describe('api response envelope (docs/05-api-design)', () => {
  test('apiOk wraps payload as { data, error: null } with status 200', async () => {
    const res = apiOk({ jobId: 'j1' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { jobId: 'j1' }, error: null })
  })

  test('apiFail wraps code/message as { data: null, error } with given status', async () => {
    const res = apiFail('validation_error', '参数无效', 400)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      data: null,
      error: { code: 'validation_error', message: '参数无效' },
    })
  })

  test('apiFail includes details when provided', async () => {
    const res = apiFail('provider_error', '生成失败', 502, { jobId: 'j1' })
    const body = await res.json()
    expect(body.error.details).toEqual({ jobId: 'j1' })
  })
})
