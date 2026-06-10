// Seedream pixel-mode sizes must satisfy: total pixels ∈ [2560*1440, 4096*4096]
// AND aspect ratio ∈ [1/16, 16]. Template dims like 1024x1024 are below the
// pixel floor, so we map the requested aspect ratio to the closest officially
// recommended 2K preset (volcengine docs 82379/1541523).
const PRESETS_2K = [
  { ratio: 1 / 1, size: '2048x2048', width: 2048, height: 2048 },
  { ratio: 4 / 3, size: '2304x1728', width: 2304, height: 1728 },
  { ratio: 3 / 4, size: '1728x2304', width: 1728, height: 2304 },
  { ratio: 16 / 9, size: '2848x1600', width: 2848, height: 1600 },
  { ratio: 9 / 16, size: '1600x2848', width: 1600, height: 2848 },
  { ratio: 3 / 2, size: '2496x1664', width: 2496, height: 1664 },
  { ratio: 2 / 3, size: '1664x2496', width: 1664, height: 2496 },
  { ratio: 21 / 9, size: '3136x1344', width: 3136, height: 1344 },
  { ratio: 9 / 21, size: '1344x3136', width: 1344, height: 3136 },
] as const

export type SeedreamSize = { size: string; width: number; height: number }

export function mapSeedreamSize(width: number | undefined, height: number | undefined): SeedreamSize {
  const ratio = width && height && height > 0 ? width / height : 1
  let best: (typeof PRESETS_2K)[number] = PRESETS_2K[0]
  let bestDiff = Number.POSITIVE_INFINITY
  for (const p of PRESETS_2K) {
    // Compare in log space so 2:1 and 1:2 are equally distant from 1:1.
    const diff = Math.abs(Math.log(ratio) - Math.log(p.ratio))
    if (diff < bestDiff) {
      bestDiff = diff
      best = p
    }
  }
  return { size: best.size, width: best.width, height: best.height }
}
