import { serverEnv } from '@/lib/env'
import { falProvider } from './fal'
import { seedreamProvider } from './seedream'
import { mockProvider } from './mock'
import type { GenerationProvider } from './types'

export function resolveProvider(
  providerName: string,
  apiKeys: { fal?: string; ark?: string } = { fal: serverEnv.FAL_API_KEY, ark: serverEnv.ARK_API_KEY },
): GenerationProvider {
  switch (providerName) {
    case 'seedream':
      if (apiKeys.ark) return seedreamProvider
      console.warn('[providers] ARK_API_KEY not set — falling back to mock provider')
      return mockProvider
    case 'fal':
      if (apiKeys.fal) return falProvider
      console.warn('[providers] FAL_API_KEY not set — falling back to mock provider')
      return mockProvider
    case 'mock':
      return mockProvider
    default:
      throw new Error(`unknown provider: ${providerName}`)
  }
}
