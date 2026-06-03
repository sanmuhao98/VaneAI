# 07 · 开发里程碑

> 节奏假设：1–2 人小队。每周完成可演示的增量。

## 总周期

```
W1 ─ 骨架        ┐
W2 ─ 单次跑通    │ Pre-MVP
W3 ─ 异步 + 库   │
W4 ─ 积分 + 后台 ┘
W5 ─ 内测打磨    ┐ Beta
W6 ─ 公开 beta   ┘
─────────────────
W7+ 视频方向(V2)
```

## W1 · 骨架打通

**目标**：登录后看到空首页；本地 + Vercel preview 都能跑。

任务：
- [x] 初始化 Next.js 16 + TS + Tailwind + shadcn
- [ ] 配 `lib/supabase/{client,server,admin}.ts`
- [ ] `supabase init` + 第一个 migration（`profiles` + trigger）
- [ ] 邮箱 Magic Link 登录 + Google OAuth
- [ ] 路由分组：`(marketing) (app) (admin) auth`
- [ ] 鉴权 layout（未登录跳 `/auth/login`）
- [ ] Vercel 项目接好；建 staging Supabase 项目
- [ ] CI：lint + typecheck

**验收**：本地登录 → 进入 `/create` 空页面；Vercel preview 同效果。

## W2 · 文生图单次闭环

**目标**：调一次 fal.ai，出一张图，存 Supabase Storage，前端能看到。

任务：
- [ ] `lib/providers/types.ts` + `lib/providers/fal.ts` + `index.ts`
- [ ] `models` 表 + seed（接入 `flux-schnell`）
- [ ] `generation_jobs` + `assets` migration（含 RLS）
- [ ] 简版 `/create` 页：prompt 输入 + 模型下拉 + 生成按钮
- [ ] **同步**版 API（仅本周临时，下周改异步）：调 fal → 存 storage → 写 job/assets → 返回
- [ ] `lib/storage/upload.ts`：从 provider URL 下载到 Supabase Storage
- [ ] 签名 URL 接口
- [ ] 前端展示返回图

**验收**：从 prompt 到看到图全链路通；图持久化在 Supabase Storage。

## W3 · 异步化 + 任务表 + 作品库

**目标**：去掉同步调，全走 Inngest；作品库可看可删。

任务：
- [ ] 安装 Inngest SDK + `app/api/inngest/route.ts`
- [ ] `inngest/functions/text-to-image.ts`（pending → running → 调 provider → 写 assets → succeeded/failed）
- [ ] 改 `POST /generations`：仅写 job + 发 event
- [ ] 前端轮询 `GET /generations/:id`（间隔 1.5s，最多 60s）
- [ ] 取消接口
- [ ] 作品库列表（游标分页）
- [ ] 作品详情页
- [ ] 软删
- [ ] 「再次生成」入口

**验收**：连续生成 5 张图，列表正常显示；取消和重试可用。

## W4 · 积分 + 配额 + 错误处理 + 最小后台

**目标**：上线前必备运营能力。

任务：
- [ ] `credit_ledger` + `daily_quota` + `profiles.credits_balance` trigger
- [ ] 创建任务事务：扣积分 + 计配额 + 写 job
- [ ] `inngest/functions/refund-on-failure.ts`
- [ ] 前端：余额展示 + 配额条 + 余额不足/配额耗尽的明确提示
- [ ] Sentry 接入（前端 + Inngest function）
- [ ] 错误统一封装 + 用户可读文案
- [ ] Admin 路由 + 白名单守卫
- [ ] Admin 任务列表 + 失败原因 + 用户列表
- [ ] `inngest/functions/cleanup-soft-deleted.ts`（cron 每日）

**验收**：余额耗尽阻断；失败任务自动回补；admin 能查任意失败 job 原因。

## W5 · 内测打磨

**目标**：5–10 个真实用户用一周。

任务：
- [ ] 设计走查：`/create` 与 `/library` 不能像默认模板（参考 design-quality 规范）
- [ ] 落地页（`(marketing)/page.tsx`）
- [ ] 服务条款 / 隐私政策静态页
- [ ] 邀请码或邀请链接（控制内测人数）
- [ ] 加 1–2 个高质量模型（flux-pro 或同类）
- [ ] 跨浏览器测试（Chrome / Safari / Firefox）
- [ ] 响应式自检（320 / 768 / 1024 / 1440）
- [ ] 关键指标埋点：注册、首次生成、N 次生成、失败、取消、删除
- [ ] 修内测反馈关键 bug

**验收**：≥5 个用户完成至少 3 次生成；NPS 收集；P95 出图 ≤60s。

## W6 · 公开 beta

**目标**：上线 vercel 域名，接管真实流量。

任务：
- [ ] 真实域名接 Vercel + DNS
- [ ] 生产 Supabase 项目调优（连接池、备份）
- [ ] 生产 Sentry + 告警规则
- [ ] 内容安全：prompt 黑词 + provider 默认安全
- [ ] 简单压测（每秒 5 个并发用户）
- [ ] README + 上线博客
- [ ] 公开

**验收**：≥50 真实用户；任务失败率 ≤5%；7 天可用性 ≥99%。

---

## W7+ · V2 视频方向（不在 MVP）

**前提**：MVP 数据稳定 + 单图毛利打平 + 用户呼声明确。

预期顺序：
1. 接入 fal.ai 视频模型（如 Kling 或 LTX）
2. `lib/providers/fal-video.ts`，复用现有 Provider 接口
3. `models` 表加视频模型行
4. UI 加图生视频入口
5. 视频任务 polling 周期改长 + 进度显示

**预计周期**：4 周。

---

## 协作约定

### Definition of Done（每个 PR）
- 通过 lint + typecheck + 单测
- 涉及 schema 改动有 migration 文件
- 涉及 RLS 改动手动验证跨用户访问
- 涉及 UI 有截图
- 关键改动有 1 句 commit message + 1 段 PR 描述

### 每周节奏
- 周一：定本周里程碑
- 周三：mid-week check-in（卡点拉齐）
- 周五：内部 demo + retro

### 卡点上报
- 任何 ≥1 天的 blocker 立即上报，不要憋
