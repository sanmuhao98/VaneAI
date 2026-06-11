import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { CreateStudio } from '@/components/studio/create-studio'

export const metadata: Metadata = { title: '创作工作台' }

export default async function CreatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: models }, { data: profile }] = await Promise.all([
    supabase
      .from('models')
      .select('id, display_name, provider_model, credits_cost')
      .eq('type', 'text_to_image')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('profiles').select('credits_balance').eq('id', user!.id).maybeSingle(),
  ])

  return (
    // 暗面（设计系统 v3 §1 明暗过渡规则）：生成工作台整页进入暖碳层，壳层保持光面。
    <div className="dark flex flex-1 flex-col bg-background text-foreground">
      <CreateStudio models={models ?? []} balance={profile?.credits_balance ?? 0} />
    </div>
  )
}
