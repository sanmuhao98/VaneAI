# Plan: VaneAI · Milestone #1 骨架打通

**Source PRD**: `.claude/prds/vaneai.prd.md`
**Selected Milestone**: #1 骨架打通 — 用户能登录后看到空首页；本地 + Vercel preview 都能跑
**Complexity**: Small（约 1.5–2 天专注工作）

## Summary

搭起 Next.js 16 + Supabase 的最小可登录骨架。**只跑通登录链路**，不接 fal.ai、不写模板、不写复刻。所有约定镜像 `docs/02-06`，落地后下一步进 milestone #2（单次复刻闭环）。

## Patterns to Mirror

直接遵循已冻结文档（不重复抄写）：

- 目录结构：`docs/06-directory-structure.md`
- 数据库 / RLS：`docs/04-data-model.md` + ADR-008
- Migration 流程：`docs/03-environments.md`
- API 错误响应：`docs/05-api-design.md`
- ADR 决策：`docs/09-decisions.md` 全部 15 条

仓库无源码，无既有代码模式可镜像；以上文档约定即权威。

## Files to Change

| File | Action | Why |
|---|---|---|
| `package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`next.config.ts`、`tailwind.config.ts`、`postcss.config.mjs`、`eslint.config.mjs` | CREATE | Next.js 16 + TS + Tailwind 初始化 |
| `.env.example`、`.env.local`、`.gitignore`、`.nvmrc` | CREATE | 环境变量模板 + 忽略规则 |
| `lib/env.ts` | CREATE | Zod 校验环境变量 |
| `lib/supabase/{client,server,admin}.ts` | CREATE | 三个 Supabase 客户端工厂；`admin.ts` 顶部 `import 'server-only'` |
| `supabase/config.toml`、`supabase/migrations/0001_init_profiles.sql`、`supabase/seed.sql` | CREATE | Supabase CLI 配置 + `profiles` 表 + auto-create trigger（详见 `docs/04-data-model.md`） |
| `app/layout.tsx`、`app/globals.css`、`app/not-found.tsx` | CREATE | 根 layout + 全局样式 |
| `app/(marketing)/page.tsx` | CREATE | 公开落地页占位（一句话标题） |
| `app/(app)/layout.tsx`、`app/(app)/page.tsx` | CREATE | 登录后路由组；layout 强制鉴权未登录跳 `/auth/login`；page 仅显示用户邮箱 + 登出 |
| `app/auth/login/page.tsx`、`app/auth/callback/route.ts` | CREATE | Magic Link 登录页 + OAuth 回调 |
| `components/ui/`（shadcn init 产出） | CREATE | shadcn 基础组件库 |
| `README.md` | CREATE | 启动命令 |

## Tasks

### Task 1: 初始化 Next.js 16 项目骨架
- **Action**：`pnpm create next-app@latest .`（TS + Tailwind + App Router + ESLint + `@/*` 别名）；`pnpm dlx shadcn@latest init`
- **Mirror**：`docs/06-directory-structure.md` 路径别名段
- **Validate**：`pnpm dev` 启动 → `http://localhost:3000` 出默认页

### Task 2: 配置环境变量校验
- **Action**：建 `lib/env.ts`，用 Zod 校验所有必需变量；`.env.example` 列出全部 key（不含值）
- **Mirror**：`docs/03-environments.md` 环境变量表
- **Validate**：`pnpm tsc --noEmit` 通过；故意删 `.env.local` 中一项 → `next dev` 启动报清晰错误

### Task 3: 初始化本地 Supabase + 第一个 migration
- **Action**：`supabase init`；写 `migrations/0001_init_profiles.sql`（profiles 表 + handle_new_user trigger + RLS，照搬 `docs/04-data-model.md` profiles 段）；`supabase start` + `supabase db reset` 跑通
- **Mirror**：`docs/04-data-model.md` profiles 表与 trigger
- **Validate**：`supabase db reset` 无错；Studio 能看到 profiles 表 + RLS 已启用

### Task 4: 三个 Supabase 客户端工厂
- **Action**：`lib/supabase/client.ts`（浏览器，使用 `@supabase/ssr` 的 `createBrowserClient`）；`lib/supabase/server.ts`（SSR / Route Handler，使用 `createServerClient`）；`lib/supabase/admin.ts`（service_role + `import 'server-only'`）
- **Mirror**：`docs/06-directory-structure.md` §4 server-only 守卫
- **Validate**：`pnpm tsc --noEmit` 通过；尝试在客户端组件 import `admin.ts` → 构建报错

### Task 5: 路由分组 + 鉴权 layout
- **Action**：建 `(marketing)`、`(app)`、`(admin)`、`auth/` 四组；`(app)/layout.tsx` 用 `server.ts` 取 session，无 session `redirect('/auth/login')`
- **Mirror**：`docs/06-directory-structure.md` 路由分组段
- **Validate**：未登录直接访问 `/` 路径走 marketing 落地；访问 `(app)` 内任意页跳登录

### Task 6: Magic Link + Google OAuth
- **Action**：登录页表单（邮箱输入 + Google 按钮）；`auth/callback/route.ts` 处理 OAuth code exchange；登出 server action
- **Mirror**：Supabase 官方 SSR auth 模板（无内部既有代码可镜像）
- **Validate**：本地 Inbucket（`http://localhost:54324`）收到 Magic Link → 点击进入 `(app)` 首页显示用户邮箱

### Task 7: Vercel + staging Supabase 项目接入
- **Action**：在 Supabase Cloud 建 staging 项目；将本地 migration 推到 staging；Vercel 项目导入仓库；填环境变量（staging Supabase URL/keys/Google OAuth）
- **Mirror**：`docs/03-environments.md` 部署流水线段
- **Validate**：Push 任意 PR 触发 Vercel preview；preview URL 能完成同样的 Magic Link 登录

### Task 8: 最小 CI（lint + typecheck）
- **Action**：`.github/workflows/ci.yml`：PR 时跑 `pnpm lint && pnpm tsc --noEmit`
- **Mirror**：`docs/02-architecture.md` CI/CD 表
- **Validate**：故意提交 lint error → CI 红；修掉 → CI 绿

## Validation

```bash
# 本地全链路
supabase start && supabase db reset
pnpm install
pnpm dev
# 浏览器：http://localhost:3000 → 进 /auth/login → Magic Link → 跳回应用首页

# 静态检查
pnpm lint
pnpm tsc --noEmit

# Vercel preview（PR 触发后由 CI 验证）
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Supabase Auth `@supabase/ssr` cookie 在 Next 16 App Router 配置坑（middleware vs server client） | Medium | 严格按 Supabase 官方 Next.js SSR 模板；遇问题不自创方案 |
| Google OAuth redirect URI 配置错（local vs staging vs prod 三套） | Medium | 三套 URL 全部加到 Google Console 白名单；用环境变量 `NEXT_PUBLIC_SITE_URL` 拼接 |
| 本地 supabase 端口冲突（54321/54322/54323/54324） | Low | `supabase/config.toml` 里改端口；冲突时 `supabase stop --no-backup` |
| `.env.local` 误提交 | Low | `.gitignore` 锁死 `.env*` + `!.env.example`；CI 检查 |

## Acceptance

- [ ] 本地从 0 起步：`supabase start` → `pnpm dev` → 完成 Magic Link 登录 → 看到 `(app)` 首页
- [ ] Vercel preview 同上能完成登录
- [ ] `pnpm lint && pnpm tsc --noEmit` 全绿
- [ ] CI workflow 在 PR 上自动跑且通过
- [ ] `profiles` 表自动通过 trigger 在新用户注册时创建（含 100 积分）
- [ ] `supabase/migrations/` 至少 1 个文件入 git；线上 staging 已应用
- [ ] **未触碰**：模型 provider、Inngest、generation_jobs 表、模板、复刻 UI（这些在 milestone #2+）
