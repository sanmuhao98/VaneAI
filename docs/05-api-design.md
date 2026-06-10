# 05 · API 设计

> 2026-06-10 重写：对齐 2026-06-04 产品重拆（爆款一键复刻，ADR-016）。
> 旧版"自由 prompt + 模型下拉"的请求体设计已作废——**API 不存在任何 prompt 字段**。
> 状态标记：✅ 已实现 · 🔜 计划（标注里程碑）。

## 总览

- **风格**：REST + JSON
- **前缀**：`/api/v1`
- **鉴权**：Supabase JWT（cookie，server 端 `createServerClient` 读取）
- **响应封装**：统一 `{ data, error }`，实现在 `lib/api/response.ts`（`apiOk` / `apiFail`）✅

```ts
type ApiResponse<T> =
  | { data: T;    error: null }
  | { data: null; error: { code: string; message: string; details?: unknown } }
```

## 错误码约定 ✅

| code | HTTP | 含义 |
|------|------|------|
| `unauthorized` | 401 | 未登录 |
| `forbidden` | 403 | 无权限（含 RLS 拦截后转成的） |
| `not_found` | 404 | 资源不存在（含模板下架） |
| `validation_error` | 400 | 参数校验失败 |
| `quota_exceeded` | 429 | 配额耗尽（当前为 `DAILY_DEV_CALL_LIMIT` 全局守卫；W4 改为用户级配额） |
| `insufficient_credits` | 402 | 积分不足（🔜 W4） |
| `provider_error` | 502 | 上游模型服务错误 |
| `internal_error` | 500 | 兜底 |

## 端点清单

### 生成任务

#### `POST /api/v1/generations` ✅（W2 同步版，W3 改异步）

一键复刻：选定模板 + 主体关键词。**没有 prompt / negativePrompt / model / 尺寸字段**——
prompt 由服务端用模板 `base_prompt` + `keyword` 拼接（ADR-016），模型与尺寸由模板预设。

```jsonc
// Request
{
  "templateId": "uuid",          // templates_public.id
  "keyword": "戴帽子的柴犬"       // 1–60 字，唯一的用户输入
}

// 200 Response（W2 同步版：直接返回结果）
{
  "data": {
    "jobId": "uuid",
    "assets": [
      { "signedUrl": "https://...?token=...", "width": 1024, "height": 1024 }
    ]
  },
  "error": null
}

// 失败示例（job 已创建后失败时带 jobId，便于排查）
{
  "data": null,
  "error": { "code": "provider_error", "message": "生成失败，请重试", "details": { "jobId": "uuid" } }
}
```

**实现要点（现状）**：
- Zod 校验 body；关键词 trim 后 1–60 字
- `runGeneration`（`lib/generation/run.ts`）：读模板基表（service_role）→ 拼 prompt → 写 job → 调 provider → 存 storage → 写 assets → 返回签名 URL
- 同步链路是 W2 临时方案（ADR-005），`maxDuration = 60` 兜底 + provider fetch 30s 超时
- `DAILY_DEV_CALL_LIMIT`（非生产环境）：当日真实 provider 调用数达上限 → `quota_exceeded` 429

**W3 改造后**：仅写 job（pending）+ 发 Inngest event，立即返回 `{ data: { job } }`；前端轮询详情接口。

---

#### `GET /api/v1/generations` 🔜 W3

列表（个人）。游标分页（不 OFFSET），走 `idx_jobs_user_created`。

```
Query: ?status=…&cursor=<job_id>&limit=20（默认 20，最大 50）
→ { "data": { "jobs": [...], "nextCursor": "uuid_or_null" }, "error": null }
```

#### `GET /api/v1/generations/:id` 🔜 W3

详情，含 assets 签名 URL（轮询目标，间隔 1.5s，最长 60s）。
**`input` 中只回 `keyword` 与尺寸——拼接后的 prompt 不落库也绝不下发**（ADR-016）。

#### `DELETE /api/v1/generations/:id` 🔜 W3

软删（`deleted_at = now()`）。

#### `POST /api/v1/generations/:id/cancel` 🔜 W3

仅 pending/running。已扣积分不自动回补（取消视为主动放弃）。

#### `POST /api/v1/generations/:id/retry` 🔜 W3

同模板 + 同 keyword 创建新任务，返回 `{ "data": { "newJobId": "uuid" } }`。

---

### 资产

#### `GET /api/v1/assets/:id/signed-url` 🔜 W3

签名 URL 过期（TTL 1h）后由前端调用续签。后端校验所有权后用 service_role 签发。

---

### 用户

#### `GET /api/v1/me` 🔜 W4

用户信息 + 积分余额 + 当日配额用量。

#### `GET /api/v1/me/credits` 🔜 W4

积分流水（分页）。

---

### 配置

#### `GET /api/v1/models` 🔜（暂无需求）

W2 后模型由模板预设，前端不再选模型；除非后台需要，否则不实现。

---

### Webhook

#### `POST /api/v1/webhooks/fal` 🔜 优化项

MVP 用 Inngest function 内 polling（ADR-005）；webhook（校验 `X-Fal-Signature`）是 V2 优化。

---

### Admin（仅白名单用户）🔜 W4

```
GET  /api/v1/admin/jobs
GET  /api/v1/admin/users
POST /api/v1/admin/users/:id/grant-credits
```

权限：`auth.user().email in ADMIN_EMAILS`。

---

## 限流策略

| 防线 | 状态 |
|------|------|
| `DAILY_DEV_CALL_LIMIT`：当日真实 provider 调用全局上限（local/preview 设置，生产不设） | ✅ |
| 用户级每日配额（`daily_quota`，默认 10 次/天） | 🔜 W4 |
| 用户级请求限流（30 req/min 写、120 req/min 读；Postgres 表 + advisory lock，不引 Redis） | 🔜 W4 |

> ⚠️ W4 的"扣积分 + 计配额 + 写 job"必须实现为**单个 Postgres function（RPC）**：
> supabase-js 走 PostgREST，不支持跨语句事务。详见 [04-data-model.md](./04-data-model.md)。

## 版本策略

- `/api/v1` 是当前唯一版本
- 破坏性变更走 `/api/v2`，旧版至少保留 30 天
- 非破坏性改动直接在 v1 加字段
