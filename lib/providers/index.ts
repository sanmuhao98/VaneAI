import { serverEnv } from '@/lib/env'
import { falProvider } from './fal'
import { mockProvider } from './mock'
import type { GenerationProvider } from './types'

export function resolveProvider(
  providerName: string,
  falApiKey: string | undefined = serverEnv.FAL_API_KEY,
): GenerationProvider {
  switch (providerName) {
    case 'fal':
      if (falApiKey) return falProvider
      console.warn('[providers] FAL_API_KEY not set — falling back to mock provider')
      return mockProvider
    case 'mock':
      return mockProvider
    default:
      throw new Error(`unknown provider: ${providerName}`)
  }
}
