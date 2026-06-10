# 文档变更日志

## 2026-06-10 · ADR-017 · 主图片 Provider 切换为火山方舟豆包 Seedream

**触发**：产品决策——图片生成先用豆包 Seedream（中文场景 + 国内稳定 + V2 参考图能力）；密钥稍后提供。

**产出**：
- ✅ `lib/providers/seedream.ts`：方舟同步端点（Bearer 鉴权，60s 超时，传输错误归 provider_error 路径）
- ✅ `mapSeedreamSize` 纯函数（TDD）：宽高比 → 官方 2K 推荐档映射（像素模式总像素下限 2560×1440，原 1024 档不可用）
- ✅ `resolveProvider` 加 seedream 分支：`ARK_API_KEY` 未配置回落 mock（与 fal 同机制，填 key 即切真）
- ✅ `models.config.watermark` 经 GenerationParams 透传（默认 true——"AI生成"角标；关闭前确认合规）
- ✅ seed + 本地库：新增 `doubao-seedream-5-lite` 模型行；双模板切换至该模型，推荐尺寸 1024→2048
- ⚠️ `provider_model` 暂填 `doubao-seedream-5-0-lite`——开通方舟模型服务后以控制台实际 Model ID/Endpoint ID 为准（改 models 行即可，零代码）

**未变**：Provider 抽象层接口、ADR-016 隔离纪律、fal 代码保留为备选。

---

## 2026-06-10 · W4 收尾 · Admin 后台

**产出**：
- ✅ 白名单守卫双层化：`isAdminEmail` 纯函数（TDD）共用于 `(admin)` layout、`getAdminUser()` API 守卫、dashboard 条件入口
- ✅ `/admin/jobs`：全用户任务列表 + 状态筛选 + 脱敏错误码列（原始报错按 jobId 查服务端日志——既定纪律）
- ✅ `/admin/users`：用户列表（GoTrue admin API + profiles 余额）+ 行内手动加分
- ✅ `POST /api/v1/admin/users/:id/grant-credits`：走 ledger（`admin_grant`），操作人记日志；未授权 403 实测
- 决策：admin 任务/用户列表为 RSC 直读（`lib/admin/queries.ts`），不开 GET API 端点（YAGNI，05 已注明）
- e2e 验收：加分 50 → 余额 99→149 + ledger 行正确；失败任务筛选展示正常

**W4 剩余**：Sentry（待用户提供 DSN）、用户级请求限流（lift 到 W5 前）。

---

## 2026-06-10 · W4 落地（核心货币层）· 积分 + 配额 + 失败回补

**产出**（计划：[2026-06-10-w4-credits-quota.md](./superpowers/plans/2026-06-10-w4-credits-quota.md)）：
- ✅ `credit_ledger` + `daily_quota` + 余额同步 trigger（migration 0008）；**余额唯一来源是 ledger**，注册赠送改走 `signup_bonus` 行
- ✅ `create_generation_job` RPC（migration 0009）：配额校验 + 扣费 + 写 job 单事务，`FOR UPDATE` 串行化并发——落实 docs/04 的 PostgREST 无事务约束
- ✅ 失败自动回补：`generation/failed` 事件（worker 失败与 stale 清扫统一触发）→ `refund-on-failure`；幂等三重保障（部分唯一索引 / unique violation 捕获 / Inngest retries 安全）
- ✅ 两个 cron：`sweep-stale-jobs`（*/10min，悬挂 → failed → 回补）、`cleanup-soft-deleted`（每日，软删 >7d 清 storage + 硬删）
- ✅ 402 `insufficient_credits` / 429 `quota_exceeded` 错误映射；`GET /api/v1/me`；dashboard 余额/配额展示；模板页消耗提示
- ✅ 集成测试四场景（扣费/不足/配额/回补幂等）+ e2e 验收（复刻余额 100→99、清零后复刻被 402 阻断且无孤儿 job）

**本期不做（roadmap 保持未勾）**：Admin 后台 UI、Sentry（需用户提供 DSN）、用户级请求限流。

---

## 2026-06-10 · W3 合并前 code review 修复

**触发**：独立 reviewer 复审 main..feat/w3 全量 diff（无 Critical，6 Important，8 Minor，判定 With fixes）。

**修复（Important 全部 + Minor 高性价比 6 项）**：
- **worker 终态写入加状态守卫**：succeeded 写入限 `status=running`、failed 写入限 `in(pending,running)`、running 转换 0 行命中即跳过——取消在任意窗口落地都不再被覆盖（W4 退款正确性的地基）
- **execute-job 整体入 try**：首次 job 读取的瞬时错误不再把任务悬挂在 pending（resolve-don't-throw 设计补全）
- **job.error 只存脱敏文案**：原始错误进服务端日志——owner 可经 PostgREST 直读 job 行，杜绝 `FAL_API_KEY is not set` 这类信息泄露
- **worker 改从 `job.provider` 解析**：消除与创建时记录值漂移（dev 限额计数依赖该列）
- **图片下载加 30s 超时**（与 provider 调用对齐，防 running 悬挂）；fal 传输层错误归类 `provider_error`（原 TimeoutError 误判 internal）
- **listJobs 入参消毒**：`/library?status=foo`、`?cursor=garbage` 不再 500
- 轮询容忍连续 2 次瞬时失败；send 失败清理路径自身加 try；`requireUser`→`getAuthUser`（名实相符）；worker 返回值不再携带签名 URL（避免进 Inngest 运行状态留存）
- **新增集成测试基建**：`RUN_DB_TESTS=1` 门控、跑真实本地 Supabase（execute-job 三条路径：成功/入口跳过/失败脱敏）；vitest alias 掉 `server-only`

**记入 backlog（W4 roadmap 已加）**：stale running/pending 清扫 cron、孤儿 assets 清理并入软删 cron、生产 INNGEST key 部署检查（03 已标必填）。

---

## 2026-06-10 · W3 落地 · 异步化 + 任务轮询 + 作品库

**产出**（计划：[2026-06-10-w3-async-jobs-library.md](./superpowers/plans/2026-06-10-w3-async-jobs-library.md)）：
- ✅ Inngest v4 接入（`eventType` 类型化事件 + `app/api/inngest` serve）；本地需 `INNGEST_DEV=1` + `npx inngest-cli dev`
- ✅ 方案 A 兑现：`runGeneration` 拆为 `createGenerationJob`（API）/ `executeGenerationJob`（worker）；prompt 由 worker 从 base_prompt + keyword 重拼（ADR-016）
- ✅ `POST /generations` 异步化：写 job + 发 event 后 202 返回；前端 1.5s 轮询 `GET /generations/:id`，60s 上限，生成中可取消（ADR-005）
- ✅ 作品库：列表（状态筛选 + created_at 游标分页 + 首图批量签名 URL）/ 详情 / 软删 / 重试 /「再次复刻」关键词预填
- ✅ migration 0007：assets SELECT 跟随 job 软删（06-10 review 遗留项闭环）
- ✅ 端到端验收：异步复刻出图、删除即列表消失（deleted_at 置位）、failed 重试生成新 job 并完成；错误信息经 `toJobView` 脱敏（内部 message 不下发）

**关键决策**：
- **worker 失败不抛、retries: 0**：失败由 `executeGenerationJob` 标 failed 后正常返回——回补（W4）落地前不让 Inngest 盲重试烧 provider 费用。
- **取消是尽力语义**：worker 启动前 + provider 返回后两次检查 `canceled`；竞态用条件 UPDATE 守卫。
- **`/assets/:id/signed-url` 推迟**：详情/列表每次响应都重新签 URL，独立续签端点暂无真实需求（YAGNI）。

**未变**：技术栈、里程碑节奏、ADR-016 隔离纪律。

---

## 2026-06-10 · 设计 review 对账 · 文档修正 + W2 加固

**触发**：全项目设计/文档 review，逐项验证后修复。

**代码修复**：
- 🐛 **credits_balance 守卫 trigger 失效（实测确认）**：`profiles_block_credits_update` 读 legacy GUC `request.jwt.claim.role`（当前 PostgREST 已不设置），导致 service_role 经 API 改余额也被拦截，W4 ledger 同步会直接爆。migration 0006 改用 `auth.jwt() ->> 'role'`；`scripts/verify-credits-guard.mjs` 三向验证通过（service_role 放行 / 用户改余额拦截 / 用户改昵称放行）。
- 🐛 **多图存储路径覆盖**：`{userId}/{jobId}/image.{ext}` + upsert 在 `numImages > 1` 时互相覆盖；路径加索引（`lib/storage/paths.ts`，TDD）。
- ✅ **`DAILY_DEV_CALL_LIMIT` 落地**：此前仅在 env/docs 承诺、代码 0 引用；现 `runGeneration` 对非 mock 调用按当日计数拦截 → 429 `quota_exceeded`。
- ✅ **job.provider 记录实际执行者**：mock 回落时不再误记 `'fal'`。
- ✅ **API 对齐 05 的 `{ data, error: { code } }` 封装**（`lib/api/response.ts`）+ 错误码；失败响应带 `details.jobId` 便于排查；`maxDuration = 60`；fal fetch 加 30s 超时（防 job 卡死 running）。
- ✅ 下载链接改 URL API 构造（原 `${signedUrl}&download` 字符串拼接脆弱）。

**文档修正（修正落原文，不再只记 CHANGELOG）**：
- `05-api-design.md` **重写**：旧版仍是 06-04 重拆前的"自由 prompt + 模型下拉"请求体（与 ADR-016 直接冲突）；已对齐复刻模型并标注各端点实现状态。
- `docs/README.md`：口径从"文生图 MVP"更新为复刻定位；索引加"最后核对"列。
- `02-architecture.md`：存储桶表对齐 04/migration 0005（`templates` 公开桶）；provider 接口片段对齐实际代码（ADR-005 同步 generate）；未引入技术标注 ⏳。
- `06-directory-structure.md` **重写**：对齐实际目录（旧版含违反 no-free-prompt 的"prompt 输入面板"描述与已废弃的 tailwind.config.ts）。
- `01-mvp-scope.md`：checkbox 改纯列表——进度勾选唯一维护在 07，消除双轨。
- `04-data-model.md`：创建任务"事务"补实现约束——PostgREST 无跨语句事务，W4 必须实现为 Postgres RPC。

**修复的工作区事故**：`.claude/`（PRD + plan）曾被误删（未提交的 `D` 状态），已 `git restore` 恢复。⚠️ `.claude/plans/vaneai-m2.plan.md` 被本 CHANGELOG 与 07 引用但**从未入库**，内容已不可恢复——W2 实际产出以 `docs/superpowers/` 下的 plan/spec 为准。

**未变**：技术栈、6 周里程碑节奏、视频方向延后、ADR 全部决策。

---

## 2026-06-10 · W2 落地 · 同步模板复刻闭环

**产出**：
- ✅ 模板库（列表 + 主题筛选 + 详情，RSC）+ 一键复刻（仅主体关键词单行框 ≤60，不暴露 prompt）
- ✅ `models` / `templates`(+`templates_public` 安全视图) / `generation_jobs` / `assets` migration + RLS + 索引
- ✅ Provider 抽象（`lib/providers/`）+ mock provider；`resolveProvider` 在无 `FAL_API_KEY` 时回落 mock，填 key 即切真 fal
- ✅ `lib/generation/run.ts` 同步流水（方案 A，W3 复用）+ `POST /api/v1/generations` + `lib/storage/upload.ts`（签名 URL）
- ✅ 引入 vitest + CI test 步骤；单测覆盖 `assemblePrompt` / `resolveProvider` / mock provider
- ✅ Playwright 端到端验证通过（含 ADR-016：DOM / 接口响应 / 网络请求均搜不到 base_prompt）

**关键决策 / 修正**：
- **storage 桶**：新增公开 `templates` 桶（编辑参考图/示范图）+ 私有 `generations` 桶（用户生成图 + 1h 签名 URL）。化解 `02-architecture`（generations+public-assets）与 `04-data-model`（templates 桶）的不一致，**以 04 为准**。
- **W2 用 mock provider 起步**：无真实 `FAL_API_KEY`，先用生成的 SVG 占位图验证整条闭环；真实 fal 活测待填 key。
- **方案 A·服务层抽离**：流水抽成 `runGeneration`，W3 异步化只移调用点。
- **安全修正（ADR-016 兜底加固）**：`templates_public` 是 security definer + 自动可更新视图，Supabase 默认给 anon/authenticated 授予 DML，经验证可越权 UPDATE/DELETE 基表绕过 RLS；已在 migration 中 `revoke insert/update/delete/truncate ... from anon, authenticated`，仅保留 select。
- **安全修正（ADR-016 兜底加固·二）**：`generation_jobs.input` 不再持久化拼接后的 prompt（jobs 行 owner 可经 RLS 读回，会泄露 base_prompt 结构）；只存 keyword + 尺寸，prompt 服务端临时重拼。

**未变**：技术栈、6 周里程碑节奏、视频方向延后、ECC 协作偏好。

---

## 2026-06-04 · W2 重拆 · 文生图 prompt → 模板一键复刻

**触发**：W1 收尾后核对进度，发现 `07-roadmap.md` 的 W2 仍写"prompt 输入 + 模型下拉"，与 2026-06-02 产品转向（方向 B·爆款一键复刻 + 记忆 `vaneai-no-free-prompt`）直接冲突。落实 06-02 CHANGELOG 里"W2/W4/W5 待 /plan 重拆"的既定 TODO。

**产出**：
- ✅ 新增 [.claude/plans/vaneai-m2.plan.md](../.claude/plans/vaneai-m2.plan.md) — Milestone #2 实施计划（同步版临时闭环）
- ✅ 重写 `07-roadmap.md` W2 章节 — 核心闭环改为「模板库 → 选模板 → 主体关键词 → 一键复刻」，明确不做异步/积分/后台/铺设
- ✅ PRD milestone #2 状态 pending → planned，挂上 plan 链接
- ✅ `04-data-model.md` 补 `templates` 表 + `templates_public` 视图 + `generation_jobs.template_id`（落实 06-02 既定 TODO）
- ✅ `09-decisions.md` 加 ADR-016（base_prompt 服务端隔离·安全视图模式）

**关键决策**：
- **base_prompt 服务端隔离**（ADR-016）：`templates` 基表仅 service_role 可读；前端只读 `templates_public` 安全视图（不含 base_prompt）。杜绝变相暴露 prompt。
- **M2 不动积分**：`credits_cost` 仅留痕，不走 ledger / 不计配额（推迟 M4）。
- **保持同步**：用最短链路实测复刻精度（PRD 核心风险），异步化推迟 M3。
- **模型选 flux-schnell**：同步链路必须卡在 Vercel function 超时内；高质量模型推迟 M5。

**未变**：技术栈、6 周里程碑节奏、视频方向延后、ECC 协作偏好。

---

## 2026-06-03 · W1 骨架收尾偏离记录

**触发**：执行代码审查后补齐 plan 偏差项。

**与 [`vaneai.plan.md`](../.claude/plans/vaneai.plan.md) 的偏离**：

- **登录后落点不放在 `(app)/page.tsx`，固定在 `/dashboard`**。
  原因：`(app)/page.tsx` 与 `(marketing)/page.tsx` 同时存在会让 `/` 路由冲突；用 `/dashboard` 作为登录态默认落点，`/` 始终走 marketing 落地页。Magic Link 邮件模板与 OAuth callback 的 `next` 默认值同步指向 `/dashboard`。
- **不引入 `tailwind.config.ts`**。Tailwind v4 走 CSS-first 配置（`@import "tailwindcss"` + `@theme inline`），无需 JS 配置文件。
- **`lib/env.ts` 拆为 `clientEnv` / `serverEnv` 两导出**，原 `env` 命名取消。客户端访问 `serverEnv` 抛错，避免类型作弊。

**未变**：技术栈、6 周里程碑、视频方向延后、ECC 协作偏好。

---

## 2026-06-02 · 产品方向重大调整 · 通用文生图 → 爆款一键复刻

**触发**：执行 `/ecc:plan-prd`，FRAME 阶段用户给出真实痛点为"看到爆款图复刻不出来、堆 prompt 半小时仍偏"，明确产品价值是"复刻"而非"生成"。

**决议**：方向 B（爆款一键复刻）+ B-1（编辑团队精选模板库）。

**影响**：
- ✅ 新增 `.claude/prds/vaneai.prd.md` — 正式 PRD（DRAFT）
- ✅ 重写 `00-vision.md` — 产品愿景从"AI 创作平台"收窄为"爆款一键复刻"
- ✅ 重写 `01-mvp-scope.md` — MVP 范围从"通用文生图"改为"模板库 + 主体关键词 + 一键复刻"，**严禁自由 prompt 输入**
- ⚠️ `02-architecture.md` 大体不变（技术栈与异步架构相同），但新增 `templates` 数据表（V2 schema），具体在 `04-data-model.md` 后续迭代时补
- ⚠️ `04-data-model.md` 后续迭代会加 `templates` 表 + `generation_jobs.template_id`
- ⚠️ `06-directory-structure.md` 会加 `lib/templates/` 与 `(app)/templates/` 路由
- ⚠️ `07-roadmap.md` W2/W4/W5 任务需调整为模板相关（待 `/plan` 拆解）
- ✅ 新增 `vaneai-no-free-prompt.md` 记忆（待加）— 强化"不给自由 prompt 入口"纪律
- ✅ 更新 `vaneai-project.md` 记忆 — 产品定位变更

**未变**：
- 技术栈（Next.js + Supabase + fal.ai + Inngest + Vercel）
- 6 周里程碑节奏
- 视频方向延后纪律
- ECC 协作偏好

**下一步**：执行 `/plan .claude/prds/vaneai.prd.md` 接 PRD，由 `/plan` 把 6 个 milestone 拆成实施计划，并相应更新受影响的 `02 / 04 / 06 / 07` 文档。

---

## 2026-06-02 · 项目文档骨架建立

- 建 `docs/` 目录
- 写入 `00-vision.md` 至 `09-decisions.md` 共 10 篇
- 此为 v0.1 启动方案基线
