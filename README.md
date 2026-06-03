# VaneAI

爆款图一键复刻工具。Next.js 16 + Supabase + fal.ai + Inngest + Vercel。

> 文档真源：[`docs/`](./docs)。PRD 在 [`.claude/prds/vaneai.prd.md`](./.claude/prds/vaneai.prd.md)，当前 milestone 计划在 [`.claude/plans/vaneai.plan.md`](./.claude/plans/vaneai.plan.md)。

## 前置依赖

- Node.js 22+（参考 `.nvmrc`）
- pnpm 11+（`package.json` 的 `packageManager` 字段为准）
- Docker Desktop
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)（`brew install supabase/tap/supabase`）

## 本地启动

```bash
# 1. 启动本地 Supabase（Postgres + Auth + Storage + Studio + Inbucket）
supabase start

# 2. 复制环境变量模板，将 supabase start 输出的 anon/service_role key 填入 .env.local
cp .env.example .env.local

# 3. 应用 migration 与 seed
supabase db reset

# 4. 启动 Next.js
pnpm install
pnpm dev
```

打开 <http://localhost:3000>：

- `/` — 公开落地页
- `/auth/login` — Magic Link / Google 登录；本地邮件查看 <http://localhost:54324>
- `/dashboard` — 登录后默认落点

## 常用脚本

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动 Next.js dev server |
| `pnpm build` | 生产构建 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript 严格检查 |
| `supabase db reset` | 重置本地数据库并重跑 migration + seed |
| `supabase migration new <name>` | 新增 migration |

## 项目结构

参见 [`docs/06-directory-structure.md`](./docs/06-directory-structure.md)。

## 数据库与 RLS

参见 [`docs/04-data-model.md`](./docs/04-data-model.md) 与 [`docs/09-decisions.md`](./docs/09-decisions.md) ADR-008。

## 部署

参见 [`docs/03-environments.md`](./docs/03-environments.md)。

- PR → Vercel Preview（连 staging Supabase）
- merge `main` → Vercel Production
- 数据库 migration 通过 `supabase db push` 推送，**不在 Studio 直接改线上结构**。
