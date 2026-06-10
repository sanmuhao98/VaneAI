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
| `quota_exceeded` | 429 | 配额耗尽（用户级每日配额 + dev 全局守卫） |
| `insufficient_credits` | 402 | 积分不足 |
| `provider_error` | 502 | 上游模型服务错误 |
| `internal_error` | 500 | 兜底 |

## 端点清单

### 生成任务

#### `POST /api/v1/generations` ✅（W3 异步版）

一键复刻：选定模板 + 主体关键词。**没有 prompt / negativePrompt / model / 尺寸字段**——
prompt 由服务端用模板 `base_prompt` + `keyword` 拼接（ADR-016），模型与尺寸由模板预设。

```jsonc
// Request
{
  "templateId": "uuid",          // templates_public.id
  "keyword": "戴帽子的柴犬"       // 1–60 字，唯一的用户输入
}

// 202 Response（异步：立即返回 pending，前端轮询详情）
{
  "data": { "job": { "id": "uuid", "status": "pending" } },
  "error": null
}

// 失败示例（job 已创建后失败时带 jobId，便于排查）
{
  "data": null,
  "error": { "code": "provider_error", "message": "生成失败，请重试", "details": { "jobId": "uuid" } }
}
```

**实现要点**：
- Zod 校验 body；关键词 trim 后 1–60 字
- `createGenerationJob`（`lib/generation/create-job.ts`）校验模板/模型 + dev 限额 + 写 pending job
- 发 Inngest event `generation/created` 后 **202** 返回 `{ data: { job: { id, status: 'pending' } } }`，绝不等 provider
- worker（`inngest/functions/text-to-image.ts` → `executeGenerationJob`）：重拼 prompt（ADR-016）→ 调 provider（30s 超时）→ 存 storage → 写 assets → 标终态；失败标 failed 后正常返回（retries:0，回补是 W4）
- 前端轮询 `GET /generations/:id`（1.5s 间隔，60s 上限，生成中可取消）
- `DAILY_DEV_CALL_LIMIT`（非生产环境）：当日真实 provider 调用数达上限 → `quota_exceeded` 429

---

#### `GET /api/v1/generations` ✅

列表（个人）。游标分页（不 OFFSET），走 `idx_jobs_user_created`。

```
Query: ?status=…&cursor=<created_at_iso>&limit=20（默认 20，最大 50）
→ { "data": { "jobs": [...含 previewUrl 首图签名 URL], "nextCursor": "iso_or_null" }, "error": null }
游标 = 上一页最后一行的 created_at（keyset 分页；MVP 体量下同毫秒碰撞可忽略，V2 换复合游标）
```

#### `GET /api/v1/generations/:id` ✅

详情，含 assets 签名 URL（轮询目标，间隔 1.5s，最长 60s）。
**`input` 中只回 `keyword` 与尺寸——拼接后的 prompt 不落库也绝不下发**（ADR-016）。

#### `DELETE /api/v1/generations/:id` ✅

软删（`deleted_at = now()`）。

#### `POST /api/v1/generations/:id/cancel` ✅

仅 pending/running。已扣积分不自动回补（取消视为主动放弃）。

#### `POST /api/v1/generations/:id/retry` ✅

同模板 + 同 keyword 创建新任务，返回 `{ "data": { "newJobId": "uuid" } }`。

---

### 资产

#### `GET /api/v1/assets/:id/signed-url` 🔜 按需

签名 URL 过期（TTL 1h）后由前端调用续签。当前轮询/详情/列表每次都返回新签 URL，刷新页面即可续签——单独端点等真实需求出现再做（YAGNI）。

---

### 用户

#### `GET /api/v1/me` ✅

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

### Admin（仅白名单用户）

#### `POST /api/v1/admin/users/:id/grant-credits` ✅

```jsonc
// Request
{ "amount": 50 }    // 1–10000 整数
// Response
{ "data": { "userId": "uuid", "balance": 149 }, "error": null }
```

写 ledger（reason `admin_grant`），trigger 同步余额；操作人记入服务端日志。

#### 任务/用户列表 — RSC 直读，不设 GET 端点（YAGNI）

`/admin/jobs`、`/admin/users` 页面经 `lib/admin/queries.ts` 直接查询（service_role），
没有第二个消费方之前不开 `GET /api/v1/admin/*` 端点。

权限：双层守卫——`(admin)` layout（页面）与 `getAdminUser()`（API）共用 `isAdminEmail(email, ADMIN_EMAILS)`。

---

## 限流策略

| 防线 | 状态 |
|------|------|
| `DAILY_DEV_CALL_LIMIT`：当日真实 provider 调用全局上限（local/preview 设置，生产不设） | ✅ |
| 用户级每日配额（`daily_quota`，默认 10 次/天，RPC 内强制） | ✅ |
| 用户级请求限流（30 req/min 写、120 req/min 读；Postgres 表 + advisory lock，不引 Redis） | 🔜 W4 |

> ✅ "扣积分 + 计配额 + 写 job"已实现为单个 Postgres function（`create_generation_job`，migration 0009）——
> supabase-js 走 PostgREST 不支持跨语句事务，多步调用会双花。详见 [04-data-model.md](./04-data-model.md)。

## 版本策略

- `/api/v1` 是当前唯一版本
- 破坏性变更走 `/api/v2`，旧版至少保留 30 天
- 非破坏性改动直接在 v1 加字段
