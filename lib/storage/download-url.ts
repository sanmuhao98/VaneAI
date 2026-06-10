// Supabase Storage: the presence of a `download` query param forces a
// Content-Disposition: attachment response. Build it with the URL API instead
// of string concatenation so it works with or without an existing query.
export function withDownloadParam(url: string): string {
  const u = new URL(url)
  u.searchParams.set('download', '')
  return u.toString()
}
