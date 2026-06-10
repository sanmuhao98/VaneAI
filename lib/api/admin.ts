import { serverEnv } from '@/lib/env'
import { getAuthUser } from './auth'
import { isAdminEmail } from './admin-allowlist'

// Returns the authenticated ADMIN user or null (not logged in / not allowlisted).
// Callers respond with apiFail('forbidden', …, 403) — do not leak which check failed.
export async function getAdminUser() {
  const user = await getAuthUser()
  if (!user || !isAdminEmail(user.email, serverEnv.ADMIN_EMAILS)) return null
  return user
}
