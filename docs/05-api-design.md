# 05 · API 设计

## 总览

- **风格**：REST + JSON
- **前缀**：`/api/v1`
- **鉴权**：Supabase JWT（cookie，server 端 `createServerClient` 读取）
- **响应封装**：统一 `{ data, error }`

```ts
type ApiResponse<T> =
  | { data: T;    error: null }
  | { data: null; error: { code: string; message: string; details?: unknown } }
```

## 错误码约定

| code | HTTP | 含义 |
|------|------|------|
| `unauthorized` | 401 | 未登录 |
| `forbidden` | 403 | 无权限（含 RLS 拦截后转成的） |
| `not_found` | 404 | 资源不存在 |
| `validation_error` | 400 | 参数校验失败 |
| `quota_exceeded` | 429 | 每日配额耗尽 |
| `insufficient_credits` | 402 | 积分不足 |
| `provider_error` | 502 | 上游模型服务错误 |
| `internal_error` | 500 | 兜底 |

## 端点清单

### 生成任务

#### `POST /api/v1/generations`

创建任务。

```jsonc
// Request
{
  "type": "text_to_image",                 // enum
  "model": "fal-flux-schnell",             // models.id
  "input": {
    "prompt": "a cat in space",
    "negativePrompt": "blurry",
    "width": 1024,
    "height": 1024,
    "seed": null,                          // null = 随机
    "numImages": 1
  }
}

// 200 Response
{
  "data": {
    "job": {
      "id": "uuid",
      "status": "pending",
      "type": "text_to_image",
      "model": "fal-flux-schnell",
      "credits_cost": 5,
      "created_at": "2026-06-02T10:00:00Z"
    }
  },
  "error": null
}
```

**实现要点**：
- Zod 校验 `input`（按 `type` 分支不同 schema）
- 单事务内：扣积分 + 写 quota + 写 job
- 提交事务后发 Inngest event `generation/created`
- 立即返回，**绝不**等 provider

---

#### `GET /api/v1/generations`

列表（个人）。

```
Query:
  ?status=succeeded|failed|pending|running
  &type=text_to_image
  &cursor=<job_id>           // 游标分页
  &limit=20                  // 默认 20，最大 50
```

```jsonc
// Response
{
  "data": {
    "jobs": [ /* job objects with first asset preview */ ],
    "nextCursor": "uuid_or_null"
  },
  "error": null
}
```

**性能**：用 `idx_jobs_user_created`，游标分页（不 OFFSET）。

---

#### `GET /api/v1/generations/:id`

详情，含 assets 签名 URL。

```jsonc
{
  "data": {
    "job": { /* full job */ },
    "assets": [
      {
        "id": "uuid",
        "kind": "image",
        "width": 1024,
        "height": 1024,
        "signedUrl": "https://...?token=...",
        "signedUrlExpiresAt": "2026-06-02T11:00:00Z"
      }
    ]
  },
  "error": null
}
```

---

#### `DELETE /api/v1/generations/:id`

软删（设 `deleted_at = now()`）。

```jsonc
{ "data": { "id": "uuid" }, "error": null }
```

---

#### `POST /api/v1/generations/:id/cancel`

取消（仅 pending/running）。

- 写 `status = canceled`，发 Inngest event `generation/cancel-requested`
- worker 收到后尽力中止 provider 调用（fal.ai 支持 cancel 接口则调用，否则忽略后续结果）
- 已扣积分**不**自动回补（取消视为用户主动放弃；如需回补走 admin）

---

#### `POST /api/v1/generations/:id/retry`

用同 `input` 创建新任务（不复用原 job id）。

```jsonc
// Response
{ "data": { "newJobId": "uuid" }, "error": null }
```

---

### 资产

#### `GET /api/v1/assets/:id/signed-url`

单独获取签名 URL（前端在 URL 过期时调用）。

```jsonc
{
  "data": {
    "url": "https://...",
    "expiresAt": "2026-06-02T11:00:00Z"
  },
  "error": null
}
```

---

### 用户

#### `GET /api/v1/me`

```jsonc
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "u@example.com",
      "displayName": "Sen",
      "avatarUrl": "..."
    },
    "credits": {
      "balance": 95,
      "todayUsed": 3,
      "todayLimit": 10
    }
  },
  "error": null
}
```

#### `GET /api/v1/me/credits`

积分流水（分页）。

---

### 配置

#### `GET /api/v1/models`

模型清单（公开缓存 60s）。

```jsonc
{
  "data": {
    "models": [
      {
        "id": "fal-flux-schnell",
        "displayName": "FLUX Schnell (快)",
        "type": "text_to_image",
        "creditsCost": 1,
        "config": { "maxWidth": 1024, "supportedRatios": ["1:1","3:4","16:9"] }
      }
    ]
  },
  "error": null
}
```

---

### Webhook

#### `POST /api/v1/webhooks/fal`

fal.ai 任务回调（如启用 webhook 模式）。

- 校验 `X-Fal-Signature` header
- 根据 `provider_job_id` 找 job，更新 status / output / error
- 不做业务逻辑，仅触发 Inngest event `generation/provider-callback-received`

> MVP 可先用 polling 模式（Inngest function 内 polling）；webhook 是优化项。

---

### Admin（仅白名单用户）

```
GET  /api/v1/admin/jobs
GET  /api/v1/admin/users
POST /api/v1/admin/users/:id/grant-credits
```

权限：检查 `auth.user().email in ADMIN_EMAILS`。

---

## 限流策略

| 端点 | 限制 |
|------|------|
| `POST /generations` | 配额 + 用户级 30 req/min |
| 其他读接口 | 用户级 120 req/min |
| Webhook | 不限（依赖签名校验） |

实现方式：Postgres 表 `rate_limits (key, window_start, count)` + advisory lock。

## 鉴权伪代码

```ts
// app/api/v1/_lib/auth.ts
export async function requireUser() {
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new ApiError('unauthorized', 401)
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (!ADMIN_EMAILS.includes(user.email)) {
    throw new ApiError('forbidden', 403)
  }
  return user
}
```

## 版本策略

- `/api/v1` 是当前唯一版本
- 破坏性变更走 `/api/v2`，旧版至少保留 30 天
- 非破坏性改动直接在 v1 加字段
