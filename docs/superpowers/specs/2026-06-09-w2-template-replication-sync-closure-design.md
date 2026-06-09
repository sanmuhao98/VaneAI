# W2 · 同步模板复刻闭环 — 设计 spec

> 日期：2026-06-09 ｜ 里程碑：W2（Pre-MVP 单次复刻闭环·同步版临时）
> 真源对齐：`docs/07-roadmap.md` W2、`docs/01-mvp-scope.md`、`docs/04-data-model.md`、`docs/02-architecture.md`、`docs/09-decisions.md`（ADR-004 / 008 / 010 / 016）、`docs/CHANGELOG.md`（2026-06-04 W2 重拆）。
> 本 spec 是「文档设计 vs 现有实现」差异分析的产出：现状只到 W1（auth + 路由分组 + profiles migration），W2 全部待建。目标是把已冻结的 W2 产品设计落地。

## 背景与差异

产品设计文档已完整且自洽（爆款一键复刻 + 严禁自由 prompt，ADR-016）。代码现状停在 W1 骨架。本 spec 覆盖 W2 全部任务：模板库 → 选模板 → 输入主体关键词 → **同步**调 provider 出图 → 存 Supabase Storage → 前端看图 + 下载。

**关键纪律（不可妥协）：**
- 前端无任何 prompt 输入面板；用户唯一输入 = 主体关键词（≤60 字）。
- `base_prompt` / `negative_prompt` 仅服务端可读（ADR-016），永不下发前端。
- M2 **不扣积分、不计配额**（推迟 M4），`credits_cost` 仅在表里留痕。
- 同步链路必须卡在 Vercel function 超时内（本轮用 mock，真 fal 选 flux-schnell）。

## 已定决策

- **架构方案 A**：整条流水抽成 `lib/generation/run.ts` 服务函数，W2 由 route handler 同步 `await` 调用；W3 异步化时改由 Inngest function 调用，调用点一移即可，业务不重写。
- **Provider 用 mock 起步**：在 Provider 抽象（ADR-004）后实现 mock provider；`resolveProvider` 在 `model.provider==='fal'` 且无 `FAL_API_KEY` 时回落 mock，填入真 key 即自动切 fal。
- **新增公开 `templates` 桶**：放编辑运营的参考图 / 示范产出（可公开，省签名 URL 链路）。化解 `02-architecture`（列 `generations`+`public-assets`）与 `04-data-model`（写 "templates 桶"）的不一致——以 `04` 为准新增 `templates` 桶。用户生成图仍走 `generations` 私有桶 + 1h 签名 URL（ADR-010）。
- **写库走 service_role**：API 先用会话 client 校验登录用户，所有特权操作（读 base_prompt、写 job/assets、传 storage）走 admin client（ADR-008）。

## 模块设计

### ① 数据层 — migrations + 桶 + seed

**Migrations（顺序依赖 models → templates → jobs/assets → storage）：**

| 文件 | 内容 | RLS |
|---|---|---|
| `..._init_models.sql` | `models` 表（照 `04-data-model`） | `authenticated` 可 SELECT `is_active=true`；写仅 service_role |
| `..._init_templates.sql` | `templates` 表 + `templates_public` 视图 | 基表 SELECT/INSERT/UPDATE 仅 service_role；视图 `grant select to authenticated`（ADR-016，视图不含 base_prompt/negative_prompt） |
| `..._init_jobs_assets.sql` | `generation_type` / `job_status` / `asset_kind` enum + `generation_jobs`（含 `template_id`）+ `assets` + 索引 | jobs：SELECT `user_id=auth.uid() and deleted_at is null`；INSERT `user_id=auth.uid()`；UPDATE 仅 service_role；禁 DELETE。assets：SELECT `user_id=auth.uid()`；写仅 service_role |
| `..._init_storage.sql` | `insert into storage.buckets` 建 `generations`（private）+ `templates`（public）；storage.objects RLS | `generations`：owner（`user_id` 前缀路径）读自己，写仅 service_role。`templates`：公开读，写仅 service_role |

索引照 `04-data-model` §索引策略落 `idx_jobs_user_created` / `idx_jobs_status_created` / `idx_jobs_provider_job` / `idx_assets_user_created` / `idx_assets_job`。

**config.toml**：声明本地桶 `[storage.buckets.generations]`（public=false）、`[storage.buckets.templates]`（public=true），含 `allowed_mime_types`（含 `image/svg+xml` 以支持 mock 占位图、`image/png`、`image/jpeg`）。

**seed.sql + 存储 seed：**
- `models`：1 行 `id='fal-flux-schnell'`，`provider='fal'`，`provider_model='fal-ai/flux/schnell'`，`type='text_to_image'`，`credits_cost=1`，`config` 含默认尺寸。
- `templates`：2–3 行，主题覆盖 `game_character` + `blind_box`；`base_prompt` 含 `{subject}` 占位；`model_id='fal-flux-schnell'`；`reference_image_path` / `sample_output_paths` 指向 `templates` 桶；`recommended_width/height`、`keyword_placeholder`、`credits_cost`。
- 存储 seed：提交 2–3 张小占位图到仓库，`supabase/seed-storage.ts`（或 `supabase storage cp`）上传到 `templates` 桶。UI 对缺图兜底。验证闭环的关键路径是**生成图**，模板图占位不影响验收。

### ② Provider 层 — `lib/providers/`

- `types.ts`：`GenerationParams`（含 `prompt/negativePrompt/model/width/height/seed`，预留视频字段）、`ProviderJobStatus`、`GenerationProvider` 接口（`submit` / `poll`），照 `02-architecture`。Provider 结果图项：`{ url?: string; bytes?: Uint8Array; contentType: string; width: number; height: number }`。
- `mock.ts`：`submit` 返回假 `providerJobId`；`poll` 立即 `succeeded`，返回**生成的 SVG 占位图字节**（按 keyword/seed 取色，**不渲染任何 prompt 文本**，守 ADR-016），`contentType='image/svg+xml'`。
- `fal.ts`：真实 fal REST（submit + poll），照文档写，本轮不活测。返回图项带 `url`。
- `index.ts`：注册表 `{ fal, mock }` + `resolveProvider(model)`：`model.provider==='fal'` → 有 `FAL_API_KEY` 返回 fal，否则 `console.warn` 后返回 mock。

### ③ 服务层 — `lib/generation/`（方案 A 核心，W3 复用）

- `prompt.ts`：`assemblePrompt(basePrompt, keyword)` 纯函数 —— 含 `{subject}` 则替换，否则 `${basePrompt}, ${keyword}`。单测覆盖两分支 + 边界（空 keyword 已被 API zod 挡掉，函数假定非空）。
- `run.ts`：`runGeneration({ userId, templateId, keyword })`，全程 admin client：
  1. 读 `templates` 基表（`is_active=false` 或不存在 → 抛 `TemplateNotFound`）+ `models` 行 → `assemblePrompt`。
  2. INSERT `generation_jobs`（`status='pending'`，`type='text_to_image'`，`template_id`，`provider=model.provider`，`model=model.id`，`input={ keyword, prompt(已拼), width, height }`，`credits_cost`）RETURNING id。**`input.prompt` 入库但绝不回前端。**
  3. UPDATE job → `running`，`started_at=now()`。
  4. `resolveProvider(model)` → `submit` + `poll` 出图。
  5. 每图：`uploadGenerationImage` → INSERT `assets`（service_role）→ `createSignedUrl`。
  6. UPDATE job → `succeeded`，`output={ assets:[{asset_id,width,height}] }`，`finished_at=now()`。
  7. 任一步出错 → UPDATE job → `failed`，`error={ code, message, raw }`（**M2 不回补积分**），抛净化后的错误。
  8. 返回 `{ jobId, status, assets:[{ signedUrl, width, height }] }`。

### ④ Storage 层 — `lib/storage/upload.ts`

- `uploadGenerationImage({ userId, jobId, image })`：`image.url` 则 fetch→arrayBuffer，否则用 `image.bytes`；上传 `generations/{userId}/{jobId}/{filename}`（admin storage）；返回 `{ bucket, storagePath, sizeBytes, mimeType, width, height }`。
- `createSignedUrl(bucket, path, ttl=3600)`：返回 1h 签名 URL（ADR-010）。

### ⑤ API — `app/api/v1/generations/route.ts`

- `POST`：
  - session client `getUser()` 校验登录（无 → 401）。
  - zod 校验 body `{ templateId: uuid, keyword: string().min(1).max(60) }`。**只收 keyword，schema 不含任何 prompt 字段。**
  - 可选 `DAILY_DEV_CALL_LIMIT` 防跑飞守卫：超限 → 429（本地默认 20）。
  - `runGeneration(...)` → 200 `{ jobId, assets }`。
  - 错误 → 中文可读文案（如「生成失败，请重试」），raw 已入 `job.error`。

### ⑥ UI — `app/(app)/templates/`

- `page.tsx`（RSC）：查 `templates_public`（会话 client，视图 grant 给 authenticated）；列表 = 缩略图（`templates` 桶公开 URL）+ 标题 + 主题标签；主题筛选走 `?theme=game_character|blind_box` search param。
- `[slug]/page.tsx`（RSC）：按 slug 查 `templates_public`；参考图 + 示范产出 + 推荐尺寸 + 「一键复刻」入口（渲染 `ReplicateForm`）。
- `[slug]/_components/ReplicateForm.tsx`（client）：**单行关键词输入（maxLength 60，无 prompt 面板）** → POST `/api/v1/generations` → loading 态 → 成功展示结果大图 + 下载 + 「再次复刻」（同模板换词）/「换个模板」（回列表）。埋 60s 重试计时钩子（W5 接真分析，本轮留事件桩）。
- `/dashboard` 加入口链接到 `/templates`。
- **本轮不做取消、不做作品库列表**（同步请求无法有意义取消；列表/详情/软删/取消/重试均属 W3）。

### ⑦ 安全验收（ADR-016）+ 测试（ADR-014）

- `templates_public` 视图字段集不含 `base_prompt`/`negative_prompt`/模型内部参数。
- API 响应仅 `signedUrl` + 尺寸；`input.prompt` 不出现在任何下发数据。
- 验收：grep 前端 bundle / 浏览器 DOM 搜不到 `base_prompt` 与拼接后的 prompt 文本。
- **前置依赖**：项目当前未装任何测试框架（package.json 无 vitest/jest）。W2 需先引入测试 runner（建议 **vitest**，与 Vite/TS 生态契合）+ 在 CI 加 `pnpm test`。这是 W2 的第一步任务。
- 单测：`assemblePrompt`（两分支）、`resolveProvider`（mock vs fal 选择）。
- 集成：`runGeneration` + 本地 Supabase —— 验证 job/assets 行写入、状态机 pending→running→succeeded、签名 URL 可访问。
- 手测：登录 → `/templates` → 选模板 → 输关键词 → 看到图 → 下载全链路通；图持久化在 `generations` 桶。

### ⑧ 错误处理

- 服务层抛分类错误（`TemplateNotFound` / `ProviderError` / `StorageError`），API 映射为中文可读文案；raw 入 `job.error` jsonb（仅 service_role 可读，admin 后台 W4 才查）。
- Provider/storage 失败 → job `failed`，前端提示重试。

### ⑨ 文档同步

- `docs/CHANGELOG.md`：记 `templates` 桶决策（化解 `02` vs `04` 不一致，以 `04` 为准）、W2 用 mock provider 起步、方案 A（服务层抽离）。
- `docs/07-roadmap.md`：勾选 W2 完成项。

## 验收标准（W2 Done）

1. 登录用户选模板 → 填关键词 → 看到图 → 下载，全链路通。
2. 图持久化在 Supabase Storage `generations` 桶，签名 URL 有效。
3. 前端响应 / DOM 搜不到 `base_prompt` 或拼接后的 prompt。
4. job/assets 行正确写入，状态机走 pending→running→succeeded（失败走 failed）。
5. 单测（assemblePrompt / resolveProvider）+ 集成测试（runGeneration）通过。
6. `pnpm lint` + `pnpm typecheck` 通过。
7. 填入真实 `FAL_API_KEY` 后无需改 seed/业务即切换到真实 fal（resolveProvider 自动路由）。

## 不在 W2 范围（推迟）

- 异步化 / Inngest（W3）｜ 积分扣减 / 配额（W4）｜ 作品库列表 / 详情 / 软删 / 取消 / 重试（W3）｜ admin 后台（W4）｜ 30–50 条模板铺设（W5）｜ 真实 fal 活测（待填 key）。
