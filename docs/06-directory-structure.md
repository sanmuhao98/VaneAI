# 06 · 项目目录结构

> 原则：按特性分目录；不要 `controllers/services/repositories` 八股；文件 200–400 行，最多 800。

```
VaneAI/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # 落地、定价、ToS（无需登录）
│   │   ├── page.tsx
│   │   ├── pricing/page.tsx
│   │   └── legal/[slug]/page.tsx
│   │
│   ├── (app)/                    # 登录后主应用（layout 强制鉴权）
│   │   ├── layout.tsx
│   │   ├── create/               # ★ 文生图主界面
│   │   │   ├── page.tsx
│   │   │   └── _components/
│   │   ├── library/              # 我的作品
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── settings/page.tsx
│   │
│   ├── (admin)/                  # 最小后台（layout 强制 admin）
│   │   ├── layout.tsx
│   │   ├── jobs/page.tsx
│   │   └── users/page.tsx
│   │
│   ├── auth/                     # 登录、回调、登出
│   │   ├── login/page.tsx
│   │   └── callback/route.ts
│   │
│   ├── api/
│   │   ├── v1/
│   │   │   ├── _lib/             # api 私有工具（auth, error, response）
│   │   │   ├── generations/
│   │   │   │   ├── route.ts          # POST list, GET list
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts      # GET, DELETE
│   │   │   │       ├── cancel/route.ts
│   │   │   │       └── retry/route.ts
│   │   │   ├── assets/[id]/signed-url/route.ts
│   │   │   ├── me/route.ts
│   │   │   ├── me/credits/route.ts
│   │   │   ├── models/route.ts
│   │   │   ├── webhooks/fal/route.ts
│   │   │   └── admin/...
│   │   └── inngest/route.ts      # Inngest serve handler
│   │
│   ├── layout.tsx
│   ├── globals.css
│   └── not-found.tsx
│
├── components/                   # 可复用 UI（按特性分子目录）
│   ├── create/                   # prompt 输入、模型选择、参数面板
│   ├── library/                  # 作品卡、详情抽屉
│   ├── job/                      # 任务状态相关组件（共享于 create + library）
│   ├── ui/                       # shadcn 基础组件
│   ├── layout/                   # nav, sidebar, footer
│   └── auth/                     # 登录表单
│
├── hooks/                        # 自定义 hooks
│   ├── use-generation.ts         # 创建/订阅任务
│   ├── use-assets.ts             # 签名 URL 缓存
│   └── use-current-user.ts
│
├── lib/                          # 业务逻辑层
│   ├── supabase/
│   │   ├── client.ts             # 浏览器端
│   │   ├── server.ts             # SSR / Route Handler
│   │   └── admin.ts              # service_role（仅服务端）
│   ├── providers/                # ★ 模型 provider 抽象层
│   │   ├── types.ts              # GenerationProvider interface
│   │   ├── fal.ts                # fal.ai 实现
│   │   ├── replicate.ts          # （V2 备选，先留空文件 + 注释）
│   │   └── index.ts              # 路由：根据 model.provider 选择
│   ├── credits/
│   │   ├── charge.ts             # 扣积分（事务）
│   │   ├── refund.ts             # 回补
│   │   └── balance.ts
│   ├── jobs/
│   │   ├── create.ts             # 创建任务的事务封装
│   │   ├── status.ts             # 状态机校验
│   │   └── permissions.ts
│   ├── storage/
│   │   ├── upload.ts             # 从 provider URL 下载并存 storage
│   │   └── signed-url.ts
│   ├── validators/               # zod schemas
│   │   ├── generation-input.ts
│   │   └── api-requests.ts
│   ├── errors.ts                 # ApiError / 错误码
│   ├── env.ts                    # 环境变量（Zod 校验）
│   └── analytics.ts              # 埋点（Vercel Analytics + 自定义）
│
├── inngest/
│   ├── client.ts                 # Inngest client
│   └── functions/
│       ├── text-to-image.ts      # ★ 主流程
│       ├── refund-on-failure.ts
│       └── cleanup-soft-deleted.ts
│
├── supabase/
│   ├── config.toml               # supabase CLI 配置
│   ├── migrations/
│   │   ├── 20260602_init.sql
│   │   ├── 20260602_generation_jobs.sql
│   │   └── ...
│   └── seed.sql                  # 默认模型 + 本地测试用户
│
├── styles/
│   └── tokens.css                # 设计 token（颜色、字号、间距）
│
├── tests/
│   ├── unit/
│   ├── integration/              # API + DB
│   └── e2e/                      # Playwright
│
├── public/                       # 静态资源
│
├── docs/                         # 项目文档（本文件夹）
│
├── docker/
│   └── docker-compose.yml        # 仅当需要额外辅助服务（MVP 通常不用）
│
├── .env.example
├── .gitignore
├── .nvmrc
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## 关键约定

### 1. 路由分组

App Router 用括号路由分组：
- `(marketing)` — 公开
- `(app)` — 登录后
- `(admin)` — admin 白名单

每组的 `layout.tsx` 负责鉴权。

### 2. `_components` / `_lib`

下划线开头的目录在 App Router 中**不会变成 URL**，用于：
- 页面私有组件（不跨页复用）
- 私有工具函数

跨页复用的组件放 `components/`，跨模块工具放 `lib/`。

### 3. Provider 抽象边界

**业务代码绝不直接 import `lib/providers/fal.ts`**，统一走 `lib/providers/index.ts`：

```ts
import { getProvider } from '@/lib/providers'
const provider = getProvider(model)  // 根据 model 配置路由
```

这是未来加视频 provider 的唯一改动入口。

### 4. Server-only 守卫

`lib/supabase/admin.ts` 顶部加：

```ts
import 'server-only'
```

防止 service_role 被误打包到客户端。

### 5. Zod 校验集中

所有外部输入（API body、search params、env）必须先过 `lib/validators/*` 或 `lib/env.ts`。

### 6. 文件大小

- 组件 < 300 行；超了拆 `_components`
- API route < 100 行；超了把业务逻辑移到 `lib/`
- 单一 `inngest/functions/*.ts` < 200 行

## 路径别名

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

约定：`@/components/...`、`@/lib/...`、`@/hooks/...`。

## .gitignore 要点

```
node_modules
.next
.env*
!.env.example
.vercel
.supabase/
*.tsbuildinfo
.DS_Store
```
