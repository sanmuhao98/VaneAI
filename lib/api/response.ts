import { NextResponse } from 'next/server'

// Unified envelope per docs/05-api-design: { data, error } — exactly one is non-null.
export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'quota_exceeded'
  | 'insufficient_credits'
  | 'provider_error'
  | 'invite_invalid'
  | 'invite_expired'
  | 'invite_exhausted'
  | 'internal_error'

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status })
}

export function apiFail(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { data: null, error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  )
}
