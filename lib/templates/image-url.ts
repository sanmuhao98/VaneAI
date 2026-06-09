import { clientEnv } from '@/lib/env'

// Builds a public URL for an image in the `templates` storage bucket.
// Encodes each path segment (preserving `/` separators) so paths with spaces
// or special characters produce a valid URL.
export function templateImageUrl(path: string): string {
  const safe = path.split('/').map(encodeURIComponent).join('/')
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/templates/${safe}`
}
