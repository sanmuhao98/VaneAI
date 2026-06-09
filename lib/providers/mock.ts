import type { GenerationParams, GenerationProvider, ProviderResult } from './types'

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Colored gradient placeholder. Seeded by prompt hash for variety, but the prompt
// text is NEVER written into the output (ADR-016).
function placeholderSvg(width: number, height: number, seed: number): string {
  const hue = seed % 360
  const hue2 = (hue + 40) % 360
  const r = Math.min(width, height) / 4
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue} 70% 60%)"/><stop offset="100%" stop-color="hsl(${hue2} 70% 45%)"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/><circle cx="${width / 2}" cy="${height / 2}" r="${r}" fill="white" fill-opacity="0.25"/></svg>`
}

export const mockProvider: GenerationProvider = {
  name: 'mock',
  supportedTypes: ['text_to_image'],
  async generate(params: GenerationParams): Promise<ProviderResult> {
    const width = params.width ?? 1024
    const height = params.height ?? 1024
    const seed = params.seed ?? hashString(params.prompt)
    const svg = placeholderSvg(width, height, seed)
    return {
      status: 'succeeded',
      images: [{ bytes: new TextEncoder().encode(svg), contentType: 'image/svg+xml', width, height }],
      raw: { provider: 'mock' },
    }
  },
}
