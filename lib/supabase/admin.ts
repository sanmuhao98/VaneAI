import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { clientEnv, serverEnv } from '@/lib/env'

export function createAdminClient() {
  return createSupabaseClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
