# W4 积分 + 配额 + 失败回补 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建任务原子扣积分 + 计每日配额（Postgres RPC，杜绝双花）；失败任务自动回补（幂等）；悬挂任务清扫；前端余额/配额展示与明确错误提示。

**Architecture:** "校验配额 → 校验余额 → 写 job → 写 ledger → 计数"五步合为单个 `create_generation_job` Postgres function（`FOR UPDATE` 行锁串行化同用户并发；PostgREST 无跨语句事务，这是 docs/04 标注的唯一正确实现）。`profiles.credits_balance` 是 `credit_ledger` 的缓存，由 AFTER INSERT trigger 同步——注册赠送也改走 ledger（`signup_bonus`）。回补经 Inngest event `generation/failed` 触发，幂等性靠 `(reason='refund', ref_job_id)` 部分唯一索引兜底（重试安全）。两个 cron：每日清理软删 7 天的 storage + 硬删；每 10 分钟清扫卡死 running/pending（标 failed → 触发回补）。**本期不做**：Admin 后台 UI（W4 后半）、Sentry（需用户提供 DSN）。

**Tech Stack:** Postgres plpgsql RPC · Inngest cron/event · Supabase RLS · vitest 集成测试（RUN_DB_TESTS 门控）。

**对齐文档:** docs/04 §关键业务流约束 · docs/05 错误码（402/429）· docs/07 W4 · ADR-009（不引 Redis）。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `supabase/migrations/20260610000003_credit_ledger_quota.sql` | ledger + daily_quota 表 + RLS + 余额同步 trigger + 注册走 ledger + 回补唯一索引 |
| `supabase/migrations/20260610000004_create_generation_job_rpc.sql` | 原子创建 RPC（仅 service_role 可执行） |
| `lib/generation/errors.ts` | + QuotaExceededError / InsufficientCreditsError |
| `lib/generation/create-job.ts` | 预检后改调 RPC；映射 RPC 异常 → 分类错误 |
| `lib/generation/refund.ts` | `refundFailedJob(jobId)`：幂等回补 |
| `inngest/client.ts` | + `generationFailed` 事件 |
| `inngest/functions/text-to-image.ts` | execute 返回 failed 时 sendEvent |
| `inngest/functions/refund-on-failure.ts` | event → refundFailedJob（retries:2，幂等安全） |
| `inngest/functions/sweep-stale-jobs.ts` | cron */10min：超时 running/pending → failed + 回补 event |
| `inngest/functions/cleanup-soft-deleted.ts` | cron 每日：软删 >7d → storage 删除 + 硬删 |
| `app/api/inngest/route.ts` | 注册 4 个 function |
| `app/api/v1/generations/route.ts` + `[id]/retry/route.ts` | 402/429 错误映射 |
| `app/api/v1/me/route.ts` | 余额 + 今日配额（docs/05） |
| `app/(app)/dashboard/page.tsx` | 余额 + 配额展示 |
| `app/(app)/templates/[slug]/page.tsx` | 消耗积分提示 |
| `lib/generation/credits.integration.test.ts` | RPC 扣费/不足/配额/回补幂等 集成测试 |
| docs（04/05/07/CHANGELOG） | 状态同步 |

---

## Task 1: ledger + quota migration（含余额同步 trigger）

- [ ] Step 1: 写 `20260610000003_credit_ledger_quota.sql`：
  - `credit_ledger`（同 docs/04 定义）+ `idx_ledger_user_created`；RLS：SELECT own，写仅 service_role
  - `daily_quota`（user_id+day PK）；RLS：SELECT own，写仅 service_role
  - **部分唯一索引** `uq_ledger_refund_once on credit_ledger (ref_job_id) where reason = 'refund'` —— 回补幂等的数据库兜底
  - trigger `credit_ledger_sync_balance`（AFTER INSERT，security definer）：`update profiles set credits_balance = credits_balance + new.delta where id = new.user_id`
  - 重写 `handle_new_user`：profile 以 0 起步 + 插入 ledger `+100 signup_bonus`（trigger 同步余额）——余额从此唯一来源是 ledger
- [ ] Step 2: `supabase migration up`；psql 验证新注册用户 balance=100 且 ledger 1 行
- [ ] Step 3: Commit

## Task 2: 原子创建 RPC

- [ ] Step 1: 写 `20260610000004_create_generation_job_rpc.sql`（`security definer` + `set search_path = public`；`revoke execute from public, anon, authenticated`）：
  模板/模型校验 → `daily_quota` upsert+`FOR UPDATE`（≥10 → `raise 'quota_exceeded'`）→ `profiles FOR UPDATE`（不足 → `raise 'insufficient_credits'`）→ insert job → insert ledger（-cost, `generation_charge`, ref_job_id）→ quota+1 → return job id
- [ ] Step 2: `supabase migration up`
- [ ] Step 3: Commit

## Task 3: 集成测试（RED）+ create-job 接 RPC（GREEN）

- [ ] Step 1: 写 `credits.integration.test.ts`（RUN_DB_TESTS 门控）：
  - 创建 job 后：balance 100→99、ledger 含 charge 行、quota=1
  - balance 清零后创建 → InsufficientCreditsError
  - quota 置 10 后创建 → QuotaExceededError
  - 失败 job 回补：balance +cost；重复回补无变化（幂等）
- [ ] Step 2: 跑 → RED（错误类/RPC 调用不存在）
- [ ] Step 3: errors.ts 加两个错误类；create-job.ts 预检（模板存在性给友好 404、dev 限额）后 `admin.rpc('create_generation_job', ...)`，按异常 message 映射错误类；`lib/generation/refund.ts` 实现幂等回补（unique violation → 视为已回补）
- [ ] Step 4: 跑 → GREEN；Commit

## Task 4: 失败回补事件链

- [ ] Step 1: inngest/client.ts 加 `generationFailed = eventType('generation/failed', {schema: z.object({jobId: z.string().uuid()})})`
- [ ] Step 2: text-to-image：execute 返回 failed → `step.sendEvent('emit-failed', generationFailed.create({jobId}))`
- [ ] Step 3: `refund-on-failure.ts`（retries:2，幂等安全）；注册到 serve route
- [ ] Step 4: typecheck + Commit

## Task 5: 两个 cron

- [ ] Step 1: `sweep-stale-jobs.ts`（`cron('*/10 * * * *')`）：`status in (pending,running) and created_at < now()-10min` → 守卫式标 failed（`.in(status)`）→ 逐个 sendEvent 回补
- [ ] Step 2: `cleanup-soft-deleted.ts`（`cron('0 4 * * *')`）：deleted_at < now()-7d → storage remove（按 bucket 分组）→ 硬删 job（assets 级联）
- [ ] Step 3: 注册 + typecheck + Commit

## Task 6: API 错误映射 + /me + 前端展示

- [ ] Step 1: generations POST / retry：QuotaExceededError → 429 `quota_exceeded`「今日免费次数已用完」；InsufficientCreditsError → 402 `insufficient_credits`「积分不足」
- [ ] Step 2: `GET /api/v1/me`：user + balance + todayUsed/todayLimit（docs/05 形态）
- [ ] Step 3: dashboard 显示「积分余额 N · 今日已用 x/10」；模板详情显示「消耗 N 积分/次」（templates_public.credits_cost 已暴露）
- [ ] Step 4: lint/typecheck + Commit

## Task 7: e2e 验收 + 文档同步

- [ ] Step 1: 浏览器：复刻成功后余额减 1；窗口期内把余额清零再复刻 → 「积分不足」提示
- [ ] Step 2: 全量检查 + RUN_DB_TESTS 集成测试
- [ ] Step 3: docs：07 勾选（Sentry/Admin 留空注明）、05 状态翻转（/me ✅、402/429 ✅）、04 事务节注"已实现为 RPC"、CHANGELOG
- [ ] Step 4: Commit

## Self-Review 备注

- 回补幂等三重保障：唯一索引（数据库）、unique violation 捕获（应用）、Inngest retries 安全（事件）。
- 取消不回补（docs/05 既定）；sweep 标 failed 的悬挂任务会回补（用户无过错）。
- handle_new_user 重写只影响新用户；本地已有用户余额不回溯（local/staging 无真实数据）。
- Admin UI 与 Sentry 明确移出本期，roadmap 保持未勾。
