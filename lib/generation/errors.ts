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
