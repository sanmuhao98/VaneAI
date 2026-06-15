# 09 · 关键技术决策清单（ADR 简化版）

> 每条记录：**决策**、**为什么**、**替代方案**、**回滚条件**。
> 决策一经记录即冻结；如需变更，新增一条 ADR-N 标注 supersedes 旧条目。

---

## ADR-001 · 前端框架：Next.js 16（App Router）

- **决策**：使用 Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui
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

## ADR-016 · 模板 base_prompt 服务端隔离（安全视图模式）

- **决策**：`templates` 基表含 `base_prompt` / `negative_prompt` / 模型内部参数，RLS 仅 `service_role` 可读写；前端只读 `templates_public` 视图（安全列子集，**不含 base_prompt**），授予 `authenticated` select。最终 prompt = 服务端用 admin client 读 base_prompt 内插用户 `keyword` 后拼接，**永不下发前端**。
- **为什么**：
  - 产品灵魂是"用户不需要懂 prompt"（PRD Out-of-scope 第 1 条 + 记忆 `vaneai-no-free-prompt`）。把模板 prompt 暴露给前端 = 变相提供 prompt，破坏定位。
  - 数据库层兜底，前端代码 bug 不会泄露 base_prompt（与 ADR-008 同源思路）。
- **替代**：列级权限（Postgres column privileges + RLS，复杂易错）；前端拿全表但代码层过滤（一旦绕过即泄露，不可接受）。
- **回滚**：N/A（这是产品纪律的技术兜底，不回滚）。

---

## ADR-017 · 主图片 Provider 切换：fal.ai → 火山方舟豆包 Seedream

- **决策**：主 provider 改为火山方舟 Seedream（`doubao-seedream-5.0-lite`，同步端点 `/api/v3/images/generations`）；fal.ai 降为备选，Provider 抽象层不变。Supersedes ADR-004 的"主 provider"部分。
- **为什么**：
  - 产品面向中文用户与中文提示词场景，Seedream 对中文 prompt 原生支持
  - 国内访问稳定性与合规（火山引擎境内服务）
  - `image` 参数原生支持参考图输入（2–14 张），为 V2"上传参考图复刻"铺路
- **关键约束**：像素模式 size 总像素下限 2560×1440——模板推荐尺寸对齐官方 2K 档（`mapSeedreamSize` 按宽高比就近映射）；返回 URL 24h 有效（管线即时转存 Storage，无影响）；`watermark` 默认 true（"AI生成"角标），经 `models.config.watermark` 可配——**关闭前确认 AI 生成内容标识的合规要求**。
- **替代**：继续 fal.ai（海外访问、计费美元）；Replicate（同前）。
- **回滚**：models 表把模板的 `model_id` 切回 `fal-flux-schnell` 即可，零代码改动。

---

## ADR-018 · 开放文生图创作工作台（模板复刻之外的第二生成通路）

- **决策**：新增 `/create` 创作工作台——用户自写 prompt 的自由文生图，与模板复刻并存。`POST /generations` 升级为 union schema（templateId+keyword ∪ type=text_to_image）；记账走 `create_t2i_generation_job` RPC（migration 0010，与 0009 完全同构的配额/扣费/ledger 单事务）；模型行（`models.type='text_to_image'` 且 `is_active`）为 source of truth，新增模型零代码上架。
- **为什么**：
  - 模板复刻覆盖"零门槛出图"，但内测用户需要表达自由度——两通路互补，共享同一套积分/配额/失败回补体系
  - Seedream 对中文 prompt 原生支持（ADR-017），自由文生图边际成本低
- **边界（ADR-016 不受影响）**：模板 `base_prompt` 仍永不出服务端；用户自写 prompt 属用户内容，持久化于 `job.input`（worker 双通路：有 `template_id` 走服务端 recipe 重组，否则读 `input.prompt`）。输出尺寸强制官方 2K 预设白名单（`mapSeedreamSize` 回环校验，拒绝手填尺寸）。
- **替代**：只做模板复刻（表达受限，放弃）；prompt 增强/改写（V2 再议）。
- **回滚**：下架 `/create` 入口 + 相关 models 行 `is_active=false`；API union 分支保留无害。

---

## ADR-019 · 内测邀请采用「激活门」而非注册门

- **决策**：注册不拦（Magic Link / Google OAuth 照常），登录后进入 `(app)` 前必须兑换一次邀请码（`invite_codes` 多次使用码 + `redeem_invite_code` RPC 原子兑换，结果记在 `profiles.invite_activated_at`）。整门由 `INVITE_GATE` 环境变量控制，admin 邮箱旁路。设计详见 [specs/2026-06-11-invite-gate-design.md](./superpowers/specs/2026-06-11-invite-gate-design.md)。
- **为什么**：
  - OAuth 注册流程无法可靠携带邀请码，注册门会漏 Google 这条路
  - 激活门控制的是「使用」而非「注册」，正是内测限人数的本意；W6 公开时 env 置 0 即拆门，零迁移
  - 多次使用码（一码 N 次）匹配 5–10 人内测的发码成本；表结构天然兼容一人一码
- **运营**：暂无管理 UI——生产插码用 SQL：`insert into invite_codes (code, max_uses, note) values ('VANE-XXXX', 10, '首批内测群');`；停用置 `is_active=false`。
- **替代**：注册门（OAuth 覆盖不到）；邮箱白名单（每加一人改配置重部署）。
- **回滚**：`INVITE_GATE=0`；表与列保留无害。

---

## ADR-020 · 产品埋点落 Supabase 事件表（不引外部分析服务）

- **决策**：关键指标埋点写入 `analytics_events`（`event` / `user_id` / `props jsonb` / `created_at`，无 RLS policy → service_role only，admin 直读）。服务端权威事件（`signup` 经 `handle_new_user` 触发器；`generation_created` / `generation_succeeded` / `generation_failed` / `generation_canceled` / `job_deleted` 经各 server 路径调 `track()`）+ 一个客户端 beacon 事件（`replicate_again`，`POST /api/v1/events` 仅收白名单）。`track()` 永不抛错、永不阻断主流程。「首次/N 次生成」按用户对 `generation_created` 计数派生，不单列字段。`/admin/events` 给计数总览 + 最近事件流。
- **为什么**：
  - 与 ADR-009「计数/配额都用 Postgres」一脉——不为 MVP 再引一个外部供应商（PostHog 等）与其配置/合规面
  - admin 立即可查、可 SQL 聚合，直接满足 01-mvp-scope 验收 #10「后台埋点收齐」
  - 事件表与 Sentry（ADR-013，错误监控）职责分离：前者产品行为，后者异常
- **替代**：PostHog/Amplitude（漏斗/留存现成，但外部依赖 + key + 额外配置，W6 数据需要时再上）；只打服务端日志（不满足「后台可查」）。
- **回滚**：停止 `track()` 调用即不再增长；表保留无害。Supersedes 无（新增能力）。

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
