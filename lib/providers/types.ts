export type GenerationType = 'text_to_image' | 'image_to_video' | 'text_to_video'

export type GenerationParams = {
  prompt: string
  negativePrompt?: string
  model: string // provider_model id, e.g. 'doubao-seedream-5-0-lite' / 'fal-ai/flux/schnell'
  width?: number
  height?: number
  seed?: number
  numImages?: number
  watermark?: boolean // seedream: AI-label watermark; sourced from models.config
  // video future: durationSeconds, fps, sourceImageUrl
}

export type ProviderImage = {
  url?: string
  bytes?: Uint8Array
  contentType: string
  width: number
  height: number
}

export type ProviderResult = {
  status: 'succeeded' | 'failed'
  images: ProviderImage[]
  raw?: unknown
}

export interface GenerationProvider {
  readonly name: string
  readonly supportedTypes: GenerationType[]
  // MVP (ADR-005): provider call is synchronous inside the worker; frontend polls the JOB.
  generate(params: GenerationParams): Promise<ProviderResult>
}
