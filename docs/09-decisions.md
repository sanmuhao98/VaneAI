# 09 · 关键技术决策清单（ADR 简化版）

> 每条记录：**决策**、**为什么**、**替代方案**、**回滚条件**。
> 决策一经记录即冻结；如需变更，新增一条 ADR-N 标注 supersedes 旧条目。

---

## ADR-001 · 前端框架：Next.js 15（App Router）

- **决策**：使用 Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui
- **为什么**：
  - Vercel 一等公民，部署免运维
  - RSC 减少客户端 bundle
  - 团队熟悉度高
- **替代**：Remix（部署 Vercel 仍可，但生态/约定不如 Next）；纯 Vite SPA（缺 SSR）
- **回滚**：（基本不会）

---

## ADR-002 · 后端：Next.js Route Handlers + Inngest

- **决策**：业务 API 用 Next.js Route Handlers；耗时任务全走 Inngest（Hosted）
- **为什么**：
  - 单仓库单部署，运维成本最低
  - Inngest 解决 Vercel function 超时问题
  - 内置重试 / cron / replay
- **替代**：
  - Trigger.dev（功能近似，Inngest 文档/社区更成熟）
  - Supabase Queues（pgmq）+ Edge Function（运维更重，调试不友好）
  - 自建 worker（运维负担最大）
- **回滚**：Inngest 出现 SLA 问题或限制时，迁 Trigger.dev（接口形态相近）

---

## ADR-003 · 数据库：Supabase Postgres（含 Auth + Storage + Realtime）

- **决策**：单一 Supabase 项目承载 Auth + DB + Storage + Realtime
- **为什么**：
  - RLS 一次性解决多租户隔离
  - JWT 鉴权与 DB 行权限同源
  - 免运维
- **替代**：自建 Postgres + Auth.js + S3（运维 + 重复造）
- **回滚**：Supabase 出限制（如 Storage 价格、连接池）时，按层迁出（最先迁 Storage 到 R2/S3）

---

## ADR-004 · 模型 Provider 起步：fal.ai

- **决策**：MVP 主 provider 选 fal.ai；接口预留多 provider 抽象
- **为什么**：
  - 文生图与文生视频生态都在 fal.ai 上活跃
  - 速度快（flux-schnell P50 < 5s）
  - 价格透明
  - Webhook + REST 都支持
- **替代**：Replicate（速度稍慢但模型更全）；OpenAI gpt-image / dall-e（价格高、限制多）
- **回滚**：抖动严重时切 Replicate（接口已抽象）

---

## ADR-005 · 异步任务模式：Inngest function + 前端轮询（MVP）

- **决策**：MVP 阶段 Inngest function 内调 provider；前端轮询 `GET /generations/:id`（1.5s/次，最长 60s）
- **为什么**：
  - Webhook 开发复杂度更高（签名校验、回调地址、本地调试）
  - 文生图 P50 < 15s，轮询完全够用
  - Supabase Realtime 是优化项，不是必需
- **替代**：Webhook（V2 引入）；Realtime 订阅（V2 引入）
- **回滚**：N/A（这是简化路径，未来加增强项）

---

## ADR-006 · 状态管理：TanStack Query + Zustand 二分

- **决策**：服务端状态走 TanStack Query；客户端 UI 状态走 Zustand；URL 状态走 search params
- **为什么**：
  - 不把服务端数据双写到客户端 store，避免一致性问题
  - URL 状态可分享、可回退
- **替代**：单一 Redux（过度抽象）；纯 React state（跨组件共享差）
- **回滚**：N/A

---

## ADR-007 · 鉴权：Supabase Auth（Magic Link + Google OAuth）

- **决策**：邮箱 Magic Link 为主，Google OAuth 为辅；不接其他 OAuth provider
- **为什么**：
  - Magic Link 体验好、无密码管理
  - Google 覆盖大多数海外用户
  - 减少 provider 维护面
- **替代**：加 GitHub / Apple / 微信（增加合规与维护成本）
- **回滚**：用户构成需求驱动（如海外占比下降则加微信）

---

## ADR-008 · RLS：全表覆盖、读写分明

- **决策**：所有用户数据表 RLS 默认拒绝；所有 SELECT/UPDATE 写明 `user_id = auth.uid()`；写操作通过 service_role 走后端
- **为什么**：
  - 多租户隔离的最强保障
  - 数据库层兜底，业务代码 bug 不会泄露数据
- **替代**：仅在业务代码层做权限（一旦绕过即泄露）
- **回滚**：N/A

---

## ADR-009 · 不引 Redis（MVP）

- **决策**：限流、计数、配额都用 Postgres 实现
- **为什么**：
  - MVP 流量 Postgres 足够
  - 多一个组件多一份运维
- **替代**：Upstash Redis（serverless 友好，但仍是额外依赖）
- **回滚**：明确出现 Postgres 性能瓶颈时切 Upstash

---

## ADR-010 · Storage：Supabase + 签名 URL

- **决策**：生成图存 Supabase Storage `generations` bucket（私有），通过签名 URL（TTL 1h）提供给前端
- **为什么**：
  - 用户内容默认私有
  - 签名 URL 可控失效
- **替代**：Cloudflare R2 / S3（运维 + 多服务）
- **回滚**：Supabase Storage 价格超出预期时迁 R2

---

## ADR-011 · 不做支付（MVP）

- **决策**：MVP 用每日免费配额 + 注册赠送积分；不接 Stripe
- **为什么**：
  - 先验证产品价值
  - Stripe 接入 + 合规额外 ≥3 天
- **替代**：（无）
- **回滚**：用户主动询问付费 + 日活达标后接入

---

## ADR-012 · 包管理器：pnpm

- **决策**：统一 pnpm；不用 npm/yarn
- **为什么**：
  - 安装快、磁盘小
  - 严格依赖隔离
- **替代**：bun（生态稳定性还在追赶）
- **回滚**：N/A

---

## ADR-013 · 错误监控：Sentry

- **决策**：Sentry 接前端 + Inngest function；不上 OTel
- **为什么**：
  - SaaS 免运维
  - 与 Vercel 集成成熟
- **替代**：Vercel 自带日志（不足以追错）
- **回滚**：成本不可接受时切自建

---

## ADR-014 · 测试金字塔（轻量版）

- **决策**：
  - 单元测试覆盖 `lib/` 关键逻辑（积分扣减、任务状态机）
  - 集成测试覆盖 API + DB（用本地 supabase）
  - E2E 用 Playwright，仅覆盖核心 5 条路径（登录、生成、列表、详情、删除）
- **为什么**：80% 覆盖率不是数字目标，是用对地方
- **替代**：BDD / 100% 覆盖（投入产出比低）
- **回滚**：N/A

---

## ADR-015 · 视频方向延后

- **决策**：MVP（W1–W6）期间不写一行视频代码；W7+ 才启动 V2
- **为什么**：
  - 并行两个方向必然两边都不好
  - 数据模型 + Provider 接口已为视频留位
- **替代**：（无可替代，并行不可接受）
- **回滚**：N/A

---

## 决策记录格式（新增 ADR 时复用）

```markdown
## ADR-NNN · <一句话标题>

- **决策**：
- **为什么**：
- **替代**：
- **回滚**：
- **Supersedes**：（如有）ADR-XXX
```
