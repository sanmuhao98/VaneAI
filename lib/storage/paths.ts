function extFromMime(mime: string): string {
  if (mime.includes('svg')) return 'svg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  return 'jpg'
}

// Index is part of the path: a job can produce several images (numImages > 1)
// and the upload uses upsert, so a fixed filename would silently overwrite.
export function buildGenerationStoragePath(userId: string, jobId: string, index: number, mime: string): string {
  return `${userId}/${jobId}/image-${index}.${extFromMime(mime)}`
}
