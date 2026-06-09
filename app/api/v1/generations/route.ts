import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { runGeneration } from '@/lib/generation/run'
import { TemplateNotFoundError } from '@/lib/generation/errors'

// Only the subject keyword is accepted — NO prompt field exists in the schema (ADR-016).
const bodySchema = z.object({
  templateId: z.string().uuid(),
  keyword: z.string().trim().min(1, '请输入主体关键词').max(60, '关键词不能超过 60 字'),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '参数无效' }, { status: 400 })
  }

  try {
    const result = await runGeneration({
      userId: user.id,
      templateId: parsed.data.templateId,
      keyword: parsed.data.keyword,
    })
    return NextResponse.json({ jobId: result.jobId, assets: result.assets })
  } catch (err) {
    if (err instanceof TemplateNotFoundError) {
      return NextResponse.json({ error: '模板不存在或已下架' }, { status: 404 })
    }
    console.error('[generations] runGeneration failed', err)
    return NextResponse.json({ error: '生成失败，请重试' }, { status: 500 })
  }
}
