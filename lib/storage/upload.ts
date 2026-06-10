import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildGenerationStoragePath } from '@/lib/storage/paths'
import type { ProviderImage } from '@/lib/providers/types'

const GENERATIONS_BUCKET = 'generations'

export type UploadedImage = {
  bucket: string
  storagePath: string
  sizeBytes: number
  mimeType: string
  width: number
  height: number
}

export async function uploadGenerationImage(args: {
  userId: string
  jobId: string
  index: number
  image: ProviderImage
}): Promise<UploadedImage> {
  const { userId, jobId, index, image } = args
  let bytes: Uint8Array
  if (image.bytes) {
    bytes = image.bytes
  } else if (image.url) {
    // Same hazard as the provider call: an un-timed hang here strands the job in
    // `running` past the function timeout, where the catch path can't reach it.
    const res = await fetch(image.url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`image download failed: ${res.status}`)
    bytes = new Uint8Array(await res.arrayBuffer())
  } else {
    throw new Error('image has neither bytes nor url')
  }

  const storagePath = buildGenerationStoragePath(userId, jobId, index, image.contentType)
  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(GENERATIONS_BUCKET)
    .upload(storagePath, new Blob([bytes as BlobPart], { type: image.contentType }), {
      contentType: image.contentType,
      upsert: true,
    })
  if (error) throw error

  return {
    bucket: GENERATIONS_BUCKET,
    storagePath,
    sizeBytes: bytes.byteLength,
    mimeType: image.contentType,
    width: image.width,
    height: image.height,
  }
}

export async function createSignedUrl(bucket: string, path: string, ttlSeconds = 3600): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, ttlSeconds)
  if (error) throw error
  return data.signedUrl
}
