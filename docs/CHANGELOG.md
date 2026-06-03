# 文档变更日志

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
