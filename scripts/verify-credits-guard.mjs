// Verification: profiles_block_credits_update trigger must
//   1. ALLOW service_role (via PostgREST) to change credits_balance
//   2. BLOCK an authenticated user changing their own credits_balance
//   3. ALLOW an authenticated user changing other columns (display_name)
// Usage: node scripts/verify-credits-guard.mjs   (local supabase must be running)
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let failed = false
function report(label, ok) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failed = true
}

const email = `guard-test-${Math.random().toString(36).slice(2)}@example.com`
const password = 'test-password-123!'
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})
if (cErr) throw cErr
const uid = created.user.id

try {
  // 1. service_role can change credits_balance
  const { error: adminErr } = await admin.from('profiles').update({ credits_balance: 150 }).eq('id', uid)
  report('service_role updates credits_balance', !adminErr)
  if (adminErr) console.log('   →', adminErr.message)

  // sign in as the user
  const userClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: sErr } = await userClient.auth.signInWithPassword({ email, password })
  if (sErr) throw sErr

  // 2. authenticated user cannot change own credits_balance
  const { error: hackErr } = await userClient.from('profiles').update({ credits_balance: 9999 }).eq('id', uid)
  const { data: afterHack } = await admin.from('profiles').select('credits_balance').eq('id', uid).single()
  report('authenticated user blocked from credits_balance', Boolean(hackErr) || afterHack?.credits_balance === 150)
  if (!hackErr && afterHack?.credits_balance !== 150) console.log('   → balance became', afterHack?.credits_balance)

  // 3. authenticated user can change display_name
  const { error: nameErr } = await userClient.from('profiles').update({ display_name: 'Guard Test' }).eq('id', uid)
  report('authenticated user updates display_name', !nameErr)
  if (nameErr) console.log('   →', nameErr.message)
} finally {
  await admin.auth.admin.deleteUser(uid)
}

process.exit(failed ? 1 : 0)
