// 批量生成模板素材：每个模板 1 张参考图 + 1 张示范产出（不同主体，演示"换主体同风格"）。
// 产物：supabase/storage/templates/{slug}.jpg + {slug}-sample.jpg（入 git，db reset 自动入桶）
//      同时上传到本地运行桶 + upsert templates 行 + 重写 seed.sql 模板段。
// 幂等：本地文件已存在则跳过生成（不重复计费）；--force 重新生成全部。
// Usage: node scripts/generate-template-assets.mjs [--force] [--only slug1,slug2]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { MODEL_ROW_ID, NEGATIVE_PROMPT, TEMPLATES } from './template-catalog.mjs'

const FORCE = process.argv.includes('--force')
const onlyArg = process.argv.find((a) => a.startsWith('--only'))
const ONLY = onlyArg ? new Set((process.argv[process.argv.indexOf(onlyArg) + 1] ?? '').split(',')) : null

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
if (!env.ARK_API_KEY) throw new Error('ARK_API_KEY missing in .env.local')

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const OUT_DIR = 'supabase/storage/templates'
mkdirSync(OUT_DIR, { recursive: true })

function assemblePrompt(basePrompt, keyword) {
  return basePrompt.includes('{subject}') ? basePrompt.replaceAll('{subject}', keyword) : `${basePrompt}, ${keyword}`
}

async function arkGenerate(prompt, attempt = 1) {
  const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
    method: 'POST',
    signal: AbortSignal.timeout(90_000),
    headers: { Authorization: `Bearer ${env.ARK_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'doubao-seedream-5-0-lite-260128',
      prompt,
      size: '2048x2048',
      sequential_image_generation: 'disabled',
      response_format: 'url',
      watermark: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 3000 * attempt))
      return arkGenerate(prompt, attempt + 1)
    }
    throw new Error(`ark ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  const url = data.data?.[0]?.url
  if (!url) throw new Error(`no image url: ${JSON.stringify(data).slice(0, 200)}`)
  return url
}

async function downloadResize(url, outPath, maxPx) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`download failed ${res.status}`)
  const tmp = `${outPath}.tmp.jpg`
  writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
  // macOS sips：等比缩放到 maxPx 边长（模板展示用，控制 git 体积）
  execFileSync('sips', ['-Z', String(maxPx), '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', tmp, '--out', outPath], {
    stdio: 'pipe',
  })
  execFileSync('rm', [tmp])
}

async function uploadToBucket(localPath, bucketPath) {
  const bytes = readFileSync(localPath)
  const { error } = await admin.storage
    .from('templates')
    .upload(bucketPath, new Blob([bytes], { type: 'image/jpeg' }), { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
}

async function processTemplate(t, index) {
  const refPath = `${OUT_DIR}/${t.slug}.jpg`
  const samplePath = `${OUT_DIR}/${t.slug}-sample.jpg`

  if (FORCE || !existsSync(refPath)) {
    const url = await arkGenerate(assemblePrompt(t.base_prompt, t.refSubject))
    await downloadResize(url, refPath, 1024)
    console.log(`  ✓ ref    ${t.slug} (${t.refSubject})`)
  } else {
    console.log(`  ↷ ref    ${t.slug} 已存在，跳过生成`)
  }

  if (FORCE || !existsSync(samplePath)) {
    const url = await arkGenerate(assemblePrompt(t.base_prompt, t.sampleSubject))
    await downloadResize(url, samplePath, 640)
    console.log(`  ✓ sample ${t.slug} (${t.sampleSubject})`)
  } else {
    console.log(`  ↷ sample ${t.slug} 已存在，跳过生成`)
  }

  await uploadToBucket(refPath, `${t.slug}.jpg`)
  await uploadToBucket(samplePath, `${t.slug}-sample.jpg`)

  const { error } = await admin.from('templates').upsert(
    {
      slug: t.slug,
      title: t.title,
      theme: t.theme,
      reference_image_path: `${t.slug}.jpg`,
      sample_output_paths: [`${t.slug}-sample.jpg`],
      base_prompt: t.base_prompt,
      negative_prompt: NEGATIVE_PROMPT,
      model_id: MODEL_ROW_ID,
      recommended_width: 2048,
      recommended_height: 2048,
      credits_cost: 1,
      keyword_placeholder: t.placeholder,
      is_active: true,
      sort_order: index,
    },
    { onConflict: 'slug' },
  )
  if (error) throw error
}

// seed.sql 模板段重写（markers 之间）
function sqlEscape(s) {
  return s.replaceAll("'", "''")
}
function regenerateSeedSection() {
  const rows = TEMPLATES.map((t, i) => {
    return `  ('${t.slug}', '${sqlEscape(t.title)}', '${t.theme}', '${t.slug}.jpg', array['${t.slug}-sample.jpg'],\n   '${sqlEscape(t.base_prompt)}',\n   '${sqlEscape(NEGATIVE_PROMPT)}',\n   '${MODEL_ROW_ID}', 2048, 2048, 1, '${sqlEscape(t.placeholder)}', ${i})`
  }).join(',\n')
  const section = `-- BEGIN generated templates (scripts/generate-template-assets.mjs — 手改会被覆盖)
insert into public.templates
  (slug, title, theme, reference_image_path, sample_output_paths, base_prompt, negative_prompt,
   model_id, recommended_width, recommended_height, credits_cost, keyword_placeholder, sort_order)
values
${rows}
on conflict (slug) do update set
  title = excluded.title, theme = excluded.theme,
  reference_image_path = excluded.reference_image_path,
  sample_output_paths = excluded.sample_output_paths,
  base_prompt = excluded.base_prompt, negative_prompt = excluded.negative_prompt,
  model_id = excluded.model_id, recommended_width = excluded.recommended_width,
  recommended_height = excluded.recommended_height, credits_cost = excluded.credits_cost,
  keyword_placeholder = excluded.keyword_placeholder, sort_order = excluded.sort_order;
-- END generated templates`
  const seed = readFileSync('supabase/seed.sql', 'utf8')
  const re = /-- BEGIN generated templates[\s\S]*-- END generated templates/
  const next = re.test(seed) ? seed.replace(re, section) : `${seed.trimEnd()}\n\n${section}\n`
  writeFileSync('supabase/seed.sql', next)
}

const list = TEMPLATES.filter((t) => !ONLY || ONLY.has(t.slug))
console.log(`生成 ${list.length} 个模板素材（并发 3）…`)
let failed = 0
const queue = list.map((t) => ({ t, index: TEMPLATES.indexOf(t) }))
async function worker() {
  while (queue.length) {
    const { t, index } = queue.shift()
    try {
      await processTemplate(t, index)
    } catch (err) {
      failed++
      console.error(`  ✗ ${t.slug}: ${err.message}`)
    }
  }
}
await Promise.all([worker(), worker(), worker()])
regenerateSeedSection()
console.log(failed ? `完成，${failed} 个失败（重跑脚本只补失败项）` : '全部完成 ✅（seed.sql 模板段已重写）')
process.exit(failed ? 1 : 0)
