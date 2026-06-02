# VaneAI 项目文档

> AI 创作平台 — 第一阶段聚焦文生图 MVP，长期演进到图生视频、文生视频。
>
> 文档版本：v0.1（启动方案）
> 最后更新：2026-06-02

## 文档索引

| 文档 | 内容 | 状态 |
|------|------|------|
| [00-vision.md](./00-vision.md) | 产品愿景、长期方向、阶段划分 | ✅ 已确认 |
| [01-mvp-scope.md](./01-mvp-scope.md) | 第一阶段 MVP 范围与验收标准 | ✅ 已确认 |
| [02-architecture.md](./02-architecture.md) | 技术架构（前端/后端/DB/存储/异步/Provider） | ✅ 已确认 |
| [03-environments.md](./03-environments.md) | 本地 / Preview / Production 环境分工 | ✅ 已确认 |
| [04-data-model.md](./04-data-model.md) | 数据模型初稿 + RLS 策略 | ✅ 已确认 |
| [05-api-design.md](./05-api-design.md) | API 设计初稿 | ✅ 已确认 |
| [06-directory-structure.md](./06-directory-structure.md) | 项目目录结构建议 | ✅ 已确认 |
| [07-roadmap.md](./07-roadmap.md) | 6 周开发里程碑 | ✅ 已确认 |
| [08-non-goals.md](./08-non-goals.md) | 当前明确不做的事 | ✅ 已确认 |
| [09-decisions.md](./09-decisions.md) | 关键技术决策清单（ADR 简化版） | ✅ 已确认 |

## 一句话总结

**两周内，用 Next.js + Supabase + fal.ai + Inngest 上线一个文生图 MVP；数据模型从第一天起就用 `generation_jobs.type` 区分图/视频任务；4-6 周后再接图生视频。**

## 核心原则

1. **可落地、可迭代、不过度设计** — MVP 不引 Redis、不自建 worker、不做多 provider 路由
2. **充分利用 Supabase + Vercel** — Auth/DB/Storage 一体化，部署免运维
3. **架构为视频铺路，但代码不提前写** — 关键扩展点（Provider 抽象、Job type 枚举）从第一天就留好
4. **不并行启动多方向** — 先把文生图做透，再加图生视频

## 下一步

完成文档后进入 W1：项目骨架搭建（Next.js + Supabase 本地环境 + Auth 跑通）。详见 [07-roadmap.md](./07-roadmap.md)。
