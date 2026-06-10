import { createClient } from '@/lib/supabase/server'

// Returns the authenticated user or null; callers respond with apiFail('unauthorized').
export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
