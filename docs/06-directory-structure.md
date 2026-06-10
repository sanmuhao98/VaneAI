# 06 · 项目目录结构

> 2026-06-10 重写：对齐复刻产品形态与 W2 实际代码。
> 原则：按特性分目录；不要 `controllers/services/repositories` 八股；文件 200–400 行，最多 800。
> 标注：无标记 = 已存在；🔜 Wn = 该里程碑创建。**不预建空目录。**

```
VaneAI/
├── app/                              # Next.js App Router
│   ├── (marketing)/                  # 公开页（无需登录）
│   │   └── page.tsx                  # 落地页（W5 设计走查）
│   ├── (app)/                        # 登录后主应用（layout 强制鉴权）
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx        # 登录后默认落点
│   │   ├── templates/                # ★ 模板库 + 一键复刻
│   │   │   ├── page.tsx              # 列表 + 主题筛选
│   │   │   └── [slug]/
│   │   │       ├── page.tsx          # 详情：参考图 + 示范产出 + 复刻表单
│   │   │       └── _components/ReplicateForm.tsx   # 仅关键词输入（ADR-016）
│   │   └── library/                  # 🔜 W3 我的作品（列表/详情/软删/重试）
│   ├── (admin)/                      # 后台（🔜 W4 补 admin 白名单守卫与页面）
│   │   └── layout.tsx
│   ├── auth/
│   │   ├── actions.ts                # Magic Link / Google OAuth / 登出 Server Actions
│   │   ├── callback/route.ts         # OTP + OAuth code 回调
│   │   └── login/
│   │       ├── page.tsx
│   │       └── _components/MagicLinkForm.tsx
│   ├── api/
│   │   ├── v1/generations/route.ts   # POST 一键复刻（W2 同步版；🔜 W3 拆 [id]/cancel/retry）
│   │   └── inngest/route.ts          # 🔜 W3 Inngest serve handler
│   ├── layout.tsx / globals.css / not-found.tsx
│
├── lib/                              # 业务逻辑层
│   ├── api/response.ts               # apiOk / apiFail 统一响应封装（docs/05）
│   ├── env.ts                        # 环境变量（Zod 校验；clientEnv/serverEnv 隔离）
│   ├── generation/
│   │   ├── run.ts                    # ★ 复刻流水线（W3 移入 Inngest function 调用）
│   │   ├── prompt.ts                 # base_prompt + keyword 拼接（纯函数）
│   │   ├── dev-limit.ts              # DAILY_DEV_CALL_LIMIT 守卫判断（纯函数）
│   │   └── errors.ts                 # 分类错误（TemplateNotFound / Provider / DevCallLimit / GenerationFailed）
│   ├── providers/                    # ★ 模型 provider 抽象层
│   │   ├── types.ts                  # GenerationProvider 接口
│   │   ├── fal.ts                    # fal.ai 同步实现（30s 超时）
│   │   ├── mock.ts                   # 无 FAL_API_KEY 时的占位实现
│   │   └── index.ts                  # resolveProvider 路由（业务代码唯一入口）
│   ├── storage/
│   │   ├── upload.ts                 # provider 产物 → Supabase Storage + 签名 URL
│   │   ├── paths.ts                  # 存储路径构造（纯函数，含多图索引）
│   │   └── download-url.ts           # 签名 URL 加 download 参数（client 可用）
│   ├── templates/image-url.ts        # templates 公开桶 URL 构造
│   ├── supabase/
│   │   ├── client.ts                 # 浏览器端
│   │   ├── server.ts                 # SSR / Route Handler（anon + cookie）
│   │   └── admin.ts                  # service_role（import 'server-only' 守卫）
│   ├── credits/                      # 🔜 W4 扣积分（RPC）/ 回补 / 余额
│   └── jobs/                         # 🔜 W3 任务查询 / 状态机校验
│
├── inngest/                          # 🔜 W3 client + functions（text-to-image / refund / cleanup）
├── components/                       # 🔜 跨页复用组件出现时再建（shadcn 落 components/ui）
├── hooks/                            # 🔜 W3 use-generation 轮询等
│
├── supabase/
│   ├── config.toml
│   ├── migrations/                   # 唯一 schema 真源（supabase db push）
│   ├── seed.sql                      # 模型 + 模板 seed（仅 local/staging）
│   ├── storage/templates/            # 本地模板占位图
│   └── templates/magic_link.html     # Auth 邮件模板
│
├── scripts/                          # 一次性验证/运维脚本（如 verify-credits-guard.mjs）
├── docs/                             # 项目文档（本文件夹）
├── public/                           # 站点静态资源
├── proxy.ts                          # Next.js 16 proxy（原 middleware）：刷新 Supabase session
├── vitest.config.ts / vitest.setup.ts
└── .env.example / next.config.ts / tsconfig.json / ...
```

## 关键约定

### 1. 路由分组

- `(marketing)` 公开；`(app)` 登录后；`(admin)` admin 白名单。每组 `layout.tsx` 负责鉴权。
- `/` 永远是 marketing 落地页；登录后落点固定 `/dashboard`（见 CHANGELOG 2026-06-03）。

### 2. `_components` / `_lib`

下划线目录不会成为 URL：页面私有组件放页面旁的 `_components/`；跨页复用才进 `components/`，跨模块工具进 `lib/`。

### 3. Provider 抽象边界

**业务代码绝不直接 import `lib/providers/fal.ts`**，统一走 `resolveProvider`（`lib/providers/index.ts`）。这是未来加视频 provider 的唯一改动入口。无 `FAL_API_KEY` 时自动回落 mock。

### 4. Server-only 守卫

`lib/supabase/admin.ts`、`lib/generation/run.ts`、`lib/storage/upload.ts` 顶部 `import 'server-only'`，防止 service_role / base_prompt 逻辑被打包进客户端。客户端访问 `serverEnv` 直接抛错（`lib/env.ts`）。

### 5. 校验集中

所有外部输入先过 Zod：API body 在 route 内 schema 校验；env 在 `lib/env.ts`。

### 6. 纯函数优先 + 测试就近

可单测的逻辑抽成纯函数（`prompt.ts` / `paths.ts` / `dev-limit.ts` / `response.ts`），测试文件与实现同目录（`*.test.ts`，vitest）。

### 7. 文件大小

组件 < 300 行；API route < 100 行（业务逻辑移 `lib/`）；单个 inngest function < 200 行。

## 路径别名

`@/*` → 项目根（tsconfig paths）。约定 `@/lib/...`、`@/app/...`。

## Tailwind v4 说明

无 `tailwind.config.ts`：v4 走 CSS-first 配置（`globals.css` 内 `@import "tailwindcss"` + `@theme inline`）。
