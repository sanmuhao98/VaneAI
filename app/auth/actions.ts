'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { clientEnv } from '@/lib/env'

const emailSchema = z.string().email()

export async function signInWithMagicLink(_prev: unknown, formData: FormData) {
  const email = emailSchema.safeParse(formData.get('email'))
  if (!email.success) {
    return { error: '请输入有效邮箱' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }
  return { sent: true }
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })
  if (error || !data.url) {
    redirect(`/auth/login?error=${encodeURIComponent(error?.message ?? 'oauth_init_failed')}`)
  }
  redirect(data.url)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth/login')
}
