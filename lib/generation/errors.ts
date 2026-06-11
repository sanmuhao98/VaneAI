export class TemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`template not found or inactive: ${templateId}`)
    this.name = 'TemplateNotFoundError'
  }
}

export class ModelNotFoundError extends Error {
  constructor(modelId: string) {
    super(`model not found, inactive, or wrong type: ${modelId}`)
    this.name = 'ModelNotFoundError'
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

export class QuotaExceededError extends Error {
  constructor() {
    super('daily quota exceeded')
    this.name = 'QuotaExceededError'
  }
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('insufficient credits')
    this.name = 'InsufficientCreditsError'
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
