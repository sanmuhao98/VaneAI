# 部署清单 · W1 Task 7

> 本文档配合 [`03-environments.md`](./03-environments.md) 与 [`.claude/plans/vaneai.plan.md`](../.claude/plans/vaneai.plan.md#task-7-vercel--staging-supabase-项目接入) 使用。
> 这一步是外部账号操作，做完即完成 W1 Task 7。

## 步骤 1 · 推送代码到 GitHub

```bash
# 在仓库根 (claude-web/) 或 VaneAI 子目录都可以；下面以 VaneAI 子目录为根 git repo 为例
cd VaneAI
git add -A
git commit -m "feat: W1 骨架完成 (auth + supabase + 路由分组)"

# 在 GitHub 新建仓库 vaneai（建议 private），然后：
git remote add origin git@github.com:<you>/vaneai.git
git branch -M main
git push -u origin main
```

CI workflow（`.github/workflows/ci.yml`）会在 push 后自动跑 lint + typecheck，应该绿。

## 步骤 2 · 建 staging Supabase 项目

1. 登录 <https://supabase.com/dashboard>，**New Project**：
   - Name: `vaneai-staging`
   - Region: 选最近的（建议 Singapore / Tokyo）
   - DB Password: 生成强密码，存进密码管理器
2. 进项目后到 **Settings → API**，记录三个值：
   - `Project URL` → 即 `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`（**仅服务端**）

## 步骤 3 · 把本地 migration 推到 staging

```bash
# 一次性绑定本地 supabase CLI 到云端项目
supabase login
supabase link --project-ref <staging-project-ref>   # ref 在 Dashboard URL 里

# 推迁移
supabase db push
```

到 Supabase Studio → Table editor 看 `profiles` 表存在、RLS 已开。

## 步骤 4 · Google OAuth（可选，本里程碑可暂缓）

> 没接 Google 也不阻断，Magic Link 已能完成登录。如果要接：

1. <https://console.cloud.google.com> → APIs & Services → Credentials → **Create OAuth client ID**（Web application）
2. Authorized redirect URIs 三套都加：
   - `http://localhost:54321/auth/v1/callback`（本地 supabase）
   - `https://<staging-project-ref>.supabase.co/auth/v1/callback`
   - `https://<prod-project-ref>.supabase.co/auth/v1/callback`（W6 接上线时）
3. 把 Client ID + Secret 填到 Supabase staging：**Authentication → Providers → Google**

## 步骤 5 · Vercel 项目接入

1. <https://vercel.com/new> → Import GitHub 仓库 `vaneai`
2. **Root Directory**：留空（本仓库 VaneAI/ 已是 git 根，非 monorepo）
3. **Framework Preset**：Next.js（自动识别）
4. **Environment Variables** —— 按下表填，**Production / Preview / Development 三栏都要勾**：

| Key | Value（staging 用） | 备注 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<vercel-project>.vercel.app` | merge main 后改成生产域名 |
| `NEXT_PUBLIC_SUPABASE_URL` | staging URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon | |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service_role | **不要勾 NEXT_PUBLIC_** |
| `ADMIN_EMAILS` | 你的邮箱 | 进 `(admin)` 路由的白名单 |
| `DAILY_DEV_CALL_LIMIT` | `50` | preview 兜底 |

> 其余（FAL_API_KEY / INNGEST_* / SENTRY_DSN）属于 W2+ 范围，本里程碑不用填。

5. **Deploy**。首次构建大约 1–2 min。

## 步骤 6 · Supabase Auth 回写 Vercel 域名

进 staging Supabase：**Authentication → URL Configuration**：

- **Site URL**：`https://<vercel-project>.vercel.app`
- **Redirect URLs** 把这三个全加：
  - `https://<vercel-project>.vercel.app/auth/callback`
  - `https://*-<your-vercel-team>.vercel.app/auth/callback`（PR preview 通配）
  - `http://localhost:3000/auth/callback`（保留本地）

Magic Link 邮件会被发到 staging 邮箱（默认 Supabase SMTP），收件箱可能被分类成垃圾邮件，留意。

## 步骤 7 · 验收

- [ ] 任意 PR 触发 Vercel preview，preview URL 能打开 `/`
- [ ] preview URL 完成 Magic Link 登录 → 跳到 `/dashboard` 显示邮箱
- [ ] 进 staging Supabase Studio → `auth.users` 出现该邮箱，`public.profiles` 同步出现 100 积分行（trigger 验证）
- [ ] CI workflow 绿
- [ ] **未触碰**：fal.ai、Inngest、generation_jobs、模板（W2+）

## 常见坑

- **Magic Link 点击后跳转 localhost**：Site URL 没配回 Vercel 域名，回到步骤 6
- **`Invalid environment variables` 在 Vercel 构建报错**：env 里某个 NEXT_PUBLIC_* 没勾 Production
- **OAuth `redirect_uri_mismatch`**：Google Console 没加完三套域名
- **service_role 被打到客户端 bundle**：本仓库 `lib/env.ts` 在客户端访问 `serverEnv` 会运行时抛错；如果你看到这个错，说明某个 client component 误 import 了它，按报错栈往回拆即可
