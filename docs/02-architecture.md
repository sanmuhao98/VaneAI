# 02 · 技术架构

## 总览图

```
┌────────────────────────────────────────────────────────────────┐
│                          用户浏览器                              │
└────────────────────────────────┬───────────────────────────────┘
                                 │  HTTPS
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│              Vercel · Next.js 16 (App Router)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ React UI    │  │ Server       │  │ Route Handlers       │   │
│  │ (RSC + CSR) │  │ Actions      │  │ /api/v1/*            │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└────────────┬─────────────────────────────────────┬─────────────┘
             │                                      │
             │ Supabase JS SDK                     │ HTTP
             ▼                                      ▼
┌──────────────────────────┐         ┌────────────────────────────┐
│       Supabase           │         │    Inngest (Hosted)        │
│  ┌───────────┐           │         │  ┌──────────────────────┐  │
│  │ Auth      │           │◀────────┤  │ Worker Functions     │  │
│  │ Postgres  │ ← RLS     │  写状态  │  │ (txt2img, etc.)      │  │
│  │ Storage   │           │         │  └──────────┬───────────┘  │
│  │ Realtime  │           │         └─────────────┼──────────────┘
│  └───────────┘           │                       │
└──────────────────────────┘                       │ HTTP
                                                   ▼
                                       ┌────────────────────────┐
                                       │   fal.ai (Provider)    │
                                       │   + 备选: Replicate    │
                                       └────────────────────────┘
```

## 前端

| 选型 | 决策 |
|------|------|
| 框架 | **Next.js 16** App Router |
| 语言 | **TypeScript**（strict） |
| 样式 | **Tailwind CSS v4** + **shadcn/ui** |
| 服务端数据 | **TanStack Query** |
| 客户端状态 | **Zustand**（仅轻量 UI 态） |
| URL 状态 | App Router search params（filters/sort/pagination） |
| 表单 | **React Hook Form** + **Zod** |
| 动效 | **Motion**（必要处） |
| 图标 | **Lucide** |
| 暗色模式 | 支持，但默认浅色（避免无脑深色） |

**渲染策略**：
- 落地页、定价页：SSG
- 应用主体（登录后）：RSC + CSR 混合，TanStack Query 管异步
- 任务详情：客户端轮询 or Supabase realtime 订阅 `generation_jobs` 表

## 后端

**单体起步：Next.js Route Handlers + Server Actions**

| 职责 | 实现位置 |
|------|---------|
| Auth 校验 | Supabase JWT，server 端 `createServerClient` |
| 业务 API | `app/api/v1/*` Route Handlers |
| 表单提交 | Server Actions（仅页面内交互，不跨页） |
| **长任务编排** | **Inngest functions（不放 Vercel function）** |
| Webhook 接收 | Route Handlers，校验签名 |

**关键约束**：
- Vercel function 默认超时 10s（Pro 60s）。**禁止在 API route 内同步调 provider**。
- 所有耗时 > 3s 的操作走 Inngest。

## 数据库 · Supabase Postgres

- **RLS 必开**：所有用户数据表 `user_id = auth.uid()` 限制
- **Migration 必走文件**：`supabase/migrations/` + `supabase db push`
- **不引 Redis**：限流、计数都走 Postgres（必要时用 advisory lock）
- 详见 [04-data-model.md](./04-data-model.md)

## 存储 · Supabase Storage

| Bucket | 可见性 | 用途 |
|--------|--------|------|
| `generations` | private | 用户生成图（通过签名 URL 给前端，TTL 1h） |
| `public-assets` | public | 站点静态图（logo / 示例） |

**签名 URL 流程**：前端请求 `/api/v1/assets/:id/signed-url` → 后端校验所有权 → 返回 1h 有效签名 URL。

**生命周期**：
- 软删 7 天后由 Inngest cron 清理 storage 文件
- 用户主动删除立即从 storage 移除

## 异步任务 · Inngest（Hosted）

**为什么选 Inngest 而非自建**：
- Vercel 一键集成，免运维
- 内置重试、dead-letter、并发控制
- 本地能 replay event，调试友好
- 长事件可达数小时（视频任务铺路）

**核心 function 列表（MVP）**：

```
inngest/functions/
  text-to-image.ts          // 接 generation.created event
  cleanup-soft-deleted.ts   // 每天 cron 清理软删 storage
  refund-on-failure.ts      // job 失败时回补积分
```

**事件流**：
```
用户点生成
  → API: 扣积分 + 写 job(pending) + 发 event "generation/created"
  → 立即返回 job_id 给前端
  → Inngest worker:
      1. 标 running
      2. 调 fal.ai
      3. 下载图存 Supabase Storage
      4. 写 assets 表
      5. 标 succeeded（或 failed → 触发 refund-on-failure）
  → 前端 realtime/polling 拿到结果
```

## 模型 Provider 抽象

为视频铺路的关键设计。**MVP 只实现一个，但接口长成视频也能套**。

```typescript
// lib/providers/types.ts
type GenerationParams = {
  prompt: string
  negativePrompt?: string
  model: string
  width?: number
  height?: number
  seed?: number
  // 视频未来加: durationSeconds, fps, sourceImageUrl
}

interface GenerationProvider {
  readonly name: string
  readonly supportedTypes: ('text_to_image' | 'image_to_video' | 'text_to_video')[]

  submit(params: GenerationParams): Promise<{ providerJobId: string }>
  poll(providerJobId: string): Promise<ProviderJobStatus>
  // 或者：onWebhook(payload) → ProviderJobStatus
}
```

**MVP 实现**：
- `lib/providers/fal.ts` — 主 provider
- `lib/providers/index.ts` — 根据 model 字段路由（MVP 只走 fal）

**未来扩展**：
- 加 `lib/providers/replicate.ts`（备选）
- 加 `image_to_video` 时新增 `falVideoProvider`，无需改业务代码

## 可观测

| 维度 | 工具 | MVP 是否上 |
|------|------|-----------|
| 错误监控 | Sentry | ✅ |
| 性能/Web Vitals | Vercel Analytics | ✅ |
| 业务指标 | 简单 SQL 查询 | ✅ |
| 数据库慢查询 | Supabase logs | ✅ |
| 分布式追踪 | OpenTelemetry | ❌（V2 再考虑） |
| 实时仪表盘 | Grafana | ❌ |

## 安全

- RLS 全表覆盖（含读写）
- Webhook 签名校验（fal.ai signature header）
- 敏感操作走 Server Actions / Route Handlers，禁止暴露 service_role key 到前端
- CSP（Vercel 配置 `next.config.js` headers）
- Rate limiting：基于 user_id + IP，Postgres 表实现（不引 Redis）

## CI/CD

| 阶段 | 触发 | 行为 |
|------|------|------|
| PR 创建 | GitHub | Vercel Preview 部署 + lint + type-check + 单测 |
| 合并 main | GitHub | Vercel Production 部署 + 自动跑 supabase migration（仅 staging→prod 推广前手动确认） |
| 定时任务 | Inngest cron | 软删清理 |
