import { serverEnv } from '@/lib/env'
import { mapSeedreamSize } from './seedream-size'
import type { GenerationParams, GenerationProvider, ProviderResult } from './types'

// 火山方舟 (Volcengine Ark) Seedream image generation — synchronous endpoint.
// Docs: https://www.volcengine.com/docs/82379/1541523
// Returned URLs expire in 24h; the pipeline downloads to Supabase Storage immediately.
const ARK_IMAGES_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'

export const seedreamProvider: GenerationProvider = {
  name: 'seedream',
  supportedTypes: ['text_to_image'],
  async generate(params: GenerationParams): Promise<ProviderResult> {
    const key = serverEnv.ARK_API_KEY
    if (!key) throw new Error('ARK_API_KEY is not set')

    // Seedream rejects sizes below 2560x1440 total pixels — map to a 2K preset.
    const mapped = mapSeedreamSize(params.width, params.height)

    let res: Response
    try {
      res = await fetch(ARK_IMAGES_URL, {
        method: 'POST',
        // Fail fast so the worker's catch path runs instead of stranding `running`.
        signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: params.model, // Ark Model ID or Endpoint ID, from the models table
          prompt: params.prompt,
          size: mapped.size,
          sequential_image_generation: 'disabled', // single image only (MVP)
          response_format: 'url',
          // Default true per API; models.config can flip it (AI-content labeling
          // regulations may require the watermark — product owner's call).
          watermark: params.watermark ?? true,
        }),
      })
    } catch (err) {
      return { status: 'failed', images: [], raw: { transport: err instanceof Error ? err.name : String(err) } }
    }

    if (!res.ok) {
      const text = await res.text()
      return { status: 'failed', images: [], raw: { status: res.status, body: text } }
    }

    const data = (await res.json()) as {
      data?: { url?: string; b64_json?: string }[]
      error?: { code?: string; message?: string }
    }
    const images = (data.data ?? [])
      .filter((img) => img.url)
      .map((img) => ({
        url: img.url!,
        contentType: 'image/jpeg', // seedream default output_format
        width: mapped.width,
        height: mapped.height,
      }))
    return { status: images.length > 0 ? 'succeeded' : 'failed', images, raw: data }
  },
}
