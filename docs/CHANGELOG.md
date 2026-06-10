# 文档变更日志

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
