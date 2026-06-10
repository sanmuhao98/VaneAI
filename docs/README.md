# VaneAI 项目文档

> 爆款图一键复刻工具 — 选模板、输入主体关键词、复刻同款风格。长期演进到图生视频、视频复刻。
>
> 文档版本：v0.3
> 最后更新：2026-06-10（文档对账，详见 [CHANGELOG.md](./CHANGELOG.md)）

## 文档索引

| 文档 | 内容 | 最后核对 |
|------|------|---------|
| [00-vision.md](./00-vision.md) | 产品愿景、长期方向、阶段划分 | 2026-06-02（复刻转向） |
| [01-mvp-scope.md](./01-mvp-scope.md) | MVP 范围与验收标准（范围定义，进度看 07） | 2026-06-10 |
| [02-architecture.md](./02-architecture.md) | 技术架构（前端/后端/DB/存储/异步/Provider） | 2026-06-10 |
| [03-environments.md](./03-environments.md) | 本地 / Preview / Production 环境分工 | 2026-06-02 |
| [04-data-model.md](./04-data-model.md) | 数据模型 + RLS 策略 | 2026-06-10 |
| [05-api-design.md](./05-api-design.md) | API 设计（已对齐复刻模型 + 实现状态标注） | 2026-06-10 |
| [06-directory-structure.md](./06-directory-structure.md) | 目录结构（现状 + 计划标注） | 2026-06-10 |
| [07-roadmap.md](./07-roadmap.md) | 6 周开发里程碑（进度勾选的唯一真源） | 2026-06-10 |
| [08-non-goals.md](./08-non-goals.md) | 当前明确不做的事 | 2026-06-02 |
| [09-decisions.md](./09-decisions.md) | 关键技术决策清单（ADR 简化版） | 2026-06-09（ADR-016） |

> 维护纪律：**修正落到原文**（必要时标注 supersedes），CHANGELOG 只做变更日志，不承担"以哪份为准"的裁决——避免读者只读单篇被误导。

## 一句话总结

**6 周内，用 Next.js + Supabase + fal.ai + Inngest 上线"爆款图一键复刻"MVP；用户唯一输入是主体关键词（严禁自由 prompt，ADR-016）；数据模型从第一天起就用 `generation_jobs.type` 区分图/视频任务，V2 顺势接视频。**

## 核心原则

1. **可落地、可迭代、不过度设计** — MVP 不引 Redis、不自建 worker、不做多 provider 路由
2. **充分利用 Supabase + Vercel** — Auth/DB/Storage 一体化，部署免运维
3. **架构为视频铺路，但代码不提前写** — 关键扩展点（Provider 抽象、Job type 枚举）从第一天就留好
4. **不并行启动多方向** — 先把图片复刻做透，再加视频
5. **不给用户写 prompt** — 模板 `base_prompt` 仅服务端可读（ADR-016），前端永不接触

## 当前进度

W2 已完成（同步复刻闭环 + mock provider 兜底）。下一步 W3：Inngest 异步化 + 作品库。详见 [07-roadmap.md](./07-roadmap.md)。
