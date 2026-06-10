export class TemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`template not found or inactive: ${templateId}`)
    this.name = 'TemplateNotFoundError'
  }
}

export class ProviderError extends Error {
  raw?: unknown
  constructor(message: string, raw?: unknown) {
    super(message)
    this.name = 'ProviderError'
    this.raw = raw
  }
}

export class DevCallLimitError extends Error {
  limit: number
  constructor(limit: number) {
    super(`daily dev provider-call limit reached (${limit})`)
    this.name = 'DevCallLimitError'
    this.limit = limit
  }
}

// Thrown once a job row exists, so callers can surface the jobId for support/debugging.
export class GenerationFailedError extends Error {
  jobId: string
  cause: unknown
  constructor(jobId: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'GenerationFailedError'
    this.jobId = jobId
    this.cause = cause
  }
}
