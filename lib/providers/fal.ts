import { serverEnv } from '@/lib/env'
import type { GenerationParams, GenerationProvider, ProviderResult } from './types'

// fal.ai synchronous endpoint. flux-schnell P50 < 5s fits the sync MVP path.
// Not exercised in W2 (mock fallback); becomes live once FAL_API_KEY is set.
export const falProvider: GenerationProvider = {
  name: 'fal',
  supportedTypes: ['text_to_image'],
  async generate(params: GenerationParams): Promise<ProviderResult> {
    const key = serverEnv.FAL_API_KEY
    if (!key) throw new Error('FAL_API_KEY is not set')

    let res: Response
    try {
      res = await fetch(`https://fal.run/${params.model}`, {
        method: 'POST',
        // Without a deadline a slow provider rides into the Vercel function timeout
        // and the job is stranded in `running` — fail fast so the catch path runs.
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          image_size: { width: params.width ?? 1024, height: params.height ?? 1024 },
          num_images: params.numImages ?? 1,
          ...(params.seed !== undefined ? { seed: params.seed } : {}),
        }),
      })
    } catch (err) {
      // Timeout / network errors are provider failures (502-class), not internal bugs.
      return { status: 'failed', images: [], raw: { transport: err instanceof Error ? err.name : String(err) } }
    }
    if (!res.ok) {
      const text = await res.text()
      return { status: 'failed', images: [], raw: { status: res.status, body: text } }
    }
    const data = (await res.json()) as {
      images?: { url: string; width?: number; height?: number; content_type?: string }[]
    }
    const images = (data.images ?? []).map((img) => ({
      url: img.url,
      contentType: img.content_type ?? 'image/jpeg',
      width: img.width ?? params.width ?? 1024,
      height: img.height ?? params.height ?? 1024,
    }))
    return { status: images.length > 0 ? 'succeeded' : 'failed', images, raw: data }
  },
}
