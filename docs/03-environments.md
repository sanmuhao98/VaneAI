# 03 · 环境分工

## 三套环境

| 环境 | 部署位置 | 数据库 | Storage | 模型 Key | 用途 |
|------|---------|--------|---------|---------|------|
| **Local** | 本机 Docker | 本地 Supabase | 本地 Storage | dev key + 限额 | 日常开发、迁移演练 |
| **Preview** | Vercel Preview | Supabase staging 项目 | staging bucket | dev key | PR review、设计走查 |
| **Production** | Vercel Production | Supabase prod 项目 | prod bucket | 生产 key | 真实用户 |

> **重要**：本地**不连**线上 Supabase。本地一套独立 Postgres + Storage，用 Supabase CLI 起。

## 本地环境（Docker）

### 工具链

- **Docker Desktop**
- **Supabase CLI**（`brew install supabase/tap/supabase`）
- **Node 20+** + **pnpm**
- **Inngest Dev Server**（`npx inngest-cli@latest dev`）

### 启动流程

```bash
# 1. 启动本地 Supabase（自动起 Postgres / Storage / Auth / Studio）
supabase start

# 2. 跑迁移
supabase db reset       # 首次或重置时
# 或
supabase db push        # 增量

# 3. 启 Next.js
pnpm dev

# 4. 启 Inngest dev server（另一个终端）
npx inngest-cli@latest dev
```

`supabase start` 会输出本地各服务地址，写入 `.env.local`：

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...           # CLI 输出
SUPABASE_SERVICE_ROLE_KEY=...               # 仅 server 端用
FAL_API_KEY=...                              # dev key
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
DAILY_DEV_CALL_LIMIT=20                      # 兜底防误烧
```

### 本地与线上的关键差异

| 维度 | 本地 | 线上 |
|------|------|------|
| Auth 邮件 | 出现在 Inbucket（http://localhost:54324） | 真实邮件 |
| Storage CDN | 本地直连 | Supabase CDN |
| Provider 调用 | 真实调，但 dev key + `DAILY_DEV_CALL_LIMIT` 兜底 | 真实调 |
| Realtime | 本地 supabase 自带 | 线上 |
| Webhook 接收 | 用 `ngrok` 或 Inngest dev tunnel | Vercel 公网域名 |

## Migration 工作流

> **铁律：从不在 Supabase Studio 直接改线上表结构。**

### 新增/修改 schema 流程

```bash
# 1. 在本地写 migration（会自动加时间戳前缀）
supabase migration new add_generation_jobs

# 2. 编辑生成的 sql 文件
#    supabase/migrations/20260602xxxx_add_generation_jobs.sql

# 3. 本地应用
supabase db reset    # 干净重跑
# 或 supabase db push（仅推未应用的迁移）

# 4. 提交 PR

# 5. PR merge → CI 自动 supabase db push 到 staging
# 6. 手动验证后 → 手动 supabase db push 到 prod
```

### Seed 数据

`supabase/seed.sql` 仅放：
- 默认模型清单
- 测试用户（仅本地）
- 默认积分配置

**禁止**：线上业务数据走 seed。

## 环境变量管理

| 变量 | Local | Preview | Production |
|------|-------|---------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | localhost | staging url | prod url |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local anon | staging anon | prod anon |
| `SUPABASE_SERVICE_ROLE_KEY` | local | staging | prod（**仅 server 端**） |
| `ARK_API_KEY`（主 provider，ADR-017） | dev key | dev key | prod key |
| `FAL_API_KEY`（备选 provider） | (可不设) | (可不设) | (可不设) |
| `INNGEST_DEV` | `1`（连本地 dev server） | (不设) | (不设) |
| `INNGEST_EVENT_KEY` | (不设，dev 模式免 key) | staging（**必填**） | prod（**必填**） |
| `INNGEST_SIGNING_KEY` | (不设，dev 模式免 key) | staging（**必填**） | prod（**必填**） |

> ⚠️ 线上 `/api/inngest` 的请求校验依赖 `INNGEST_SIGNING_KEY`——`lib/env.ts` 里这两个 key 是 optional（迁就本地 dev 模式），部署 checklist 必须人工确认已配置，缺了不会在启动时报错。
| `SENTRY_DSN` | (空) | staging dsn | prod dsn |
| `ADMIN_EMAILS` | dev list | dev list | 真实白名单 |
| `DAILY_DEV_CALL_LIMIT` | 20 | 50 | (不设) |
| `INVITE_GATE`（ADR-019 内测激活门） | `0`（默认关） | `1` | 内测期 `1`，公开 beta 置 `0` |

**存放规则**：
- **Local**：`.env.local`（gitignore）
- **Preview / Production**：Vercel Project Env Vars，按环境隔离
- **任何 key 都不进 git，不进 docs**

## 部署流水线

```
开发者本机
  ↓ git push
GitHub
  ├─ PR → Vercel Preview（连 staging Supabase）
  │       └─ CI: lint + typecheck + unit test + supabase db push --staging
  └─ merge main → Vercel Production
          └─ CI: 同上 + 触发 Sentry release
                └─ 手动: supabase db push --production（高敏 migration 时）
```

## 域名与 DNS

| 域名 | 用途 |
|------|------|
| `vaneai.app`（待定） | 生产 |
| `staging.vaneai.app` | staging |
| `*.vercel.app` | Preview |

DNS 走 Vercel 接管。

## 数据迁移到 Production 的检查清单

每次推线上 migration 前：

- [ ] migration 在本地 `supabase db reset` 通过
- [ ] migration 在 staging 通过且无回滚
- [ ] 是否破坏性变更（DROP / RENAME）？是 → 走 expand-contract 两步
- [ ] 是否新增 NOT NULL 列？是 → 先加可空 + 回填 + 再设 NOT NULL
- [ ] RLS 策略是否同步更新
- [ ] 索引是否需要并发创建（CONCURRENTLY）
- [ ] 通知协作者
