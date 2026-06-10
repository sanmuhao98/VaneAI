export type JobViewRow = {
  id: string
  status: string
  type: string
  template_id: string | null
  input: { keyword?: string; width?: number; height?: number } & Record<string, unknown>
  error: { code?: string } | null
  created_at: string
  finished_at: string | null
}

// Client-safe projection. Input fields are whitelisted and error.message is replaced
// with generic copy — provider raw messages may leak internals (ADR-016 defence in depth).
export function toJobView(row: JobViewRow) {
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    templateId: row.template_id,
    keyword: row.input.keyword ?? null,
    width: row.input.width ?? null,
    height: row.input.height ?? null,
    error: row.error ? { code: row.error.code ?? 'internal_error', message: '生成失败，请重试' } : null,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  }
}

export type JobView = ReturnType<typeof toJobView>
