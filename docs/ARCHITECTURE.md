# DesignFeed Architecture

## 核心路径

```text
发现 Feed → 网站详情真实预览 → DesignSpec → 已验证 RemixArtifact → 复刻
```

公开页面由 Next.js App Router 服务端渲染。Supabase 已配置时，公开 Feed 只查询 `published` 内容；未配置时可显示 20 条只读演示数据。只有开发/测试环境允许演示用户与内存任务，生产环境缺配置时不会授予演示管理员身份，认证、投稿、收藏和分析回调均 fail closed。客户端只负责无刷新筛选、游标分页、收藏反馈和详情交互。

## 投稿与分析

```text
登录用户提交 URL
  → Supabase submit_site RPC 以用户级事务锁原子校验重复、每日 3 条和最多 5 个待处理任务
  → Cloudflare Queue
  → Browser Rendering 校验 DNS/重定向并采集桌面与移动截图
  → 私有 Supabase Storage 签名直传
  → 受信任的 Kimi/OpenAI 服务端适配器生成 DesignSpec 1.0（解释层）
  → 自托管确定性编译器生成 Next.js 代码包并在四个视口构建、渲染、比较
  → 最差视口视觉相似度 ≥ 90% 且所有结构/布局/交互门禁通过
  → HMAC 回调写入 in_review
  → 管理员修订 DesignSpec / 分类，并逐项检查 Remix 证据与最差视口
  → published
```

失败任务按指数退避最多重试 3 次。回调包含时间戳、防重放签名和状态迁移校验；签名认领、Job 与 Site 更新在同一个数据库事务中完成。管理员通过、驳回和重试也以事务同时更新 Site、Job 与审核日志。`analysis_job_events` 通过数据库触发器保存每次阶段变化、阶段耗时、尝试次数和错误码，采集阶段不会占用页面请求。

采集器对主文档体积、页面请求数量、媒体请求、重定向次数、完整截图高度和提取证据体积设置硬上限；任一视口的 Render IR 发生节点截断或结构不完整时，任务直接失败，不会用残缺证据发布。iframe 能力会结合正式站点 Origin 校验 `frame-ancestors`，不只按通配规则猜测。

设计分析默认使用 Kimi 中国开放平台的 Chat Completions Structured Output，也保留 OpenAI Responses 兼容路径。Kimi Base URL 只允许 `api.moonshot.cn` 或 `api.moonshot.ai` 的官方 `/v1` 地址，避免服务端 Key 因错误配置发送到第三方域名；无论使用哪个模型，返回结果都必须再次通过 `DesignSpec 1.0` Schema 校验。

## 数据与访问控制

- `profiles`：公开基础资料；用户只能修改自己的非角色字段。
- `sites`：访客只读已发布内容；投稿者可读自己的任务；管理员管理审核状态。
- `favorites`：只允许当前用户读写自己的组合键记录。
- `analysis_jobs`：投稿者只读自己网站的任务；Worker 通过受信任回调更新。
- `moderation_logs`：仅管理员读写，保留通过、驳回、重试与修订证据。
- 截图 Bucket 为私有；公开内容通过 `/api/screenshots/[siteId]/[variant]` 状态感知代理读取，待审核内容仅管理员可见。
- Data API 权限不依赖 Supabase 的自动暴露默认值：匿名角色只读取公开 Feed 所需列，认证角色在 RLS 下读取本人数据，回调账本仅 Service Role 可读。

## Remix 2.0 交付与安全边界

详情页复制的是短 `Remix Launcher 2.0`：它包含经过 SHA-256 校验的 `.tgz` 代码包地址、Manifest 地址和逐视口质量结果。AI 必须从代码包开始修改，不再根据 DesignSpec 长文本从零猜页面。第三方证据继续放在 `BEGIN_UNTRUSTED_REFERENCE_DATA` / `END_UNTRUSTED_REFERENCE_DATA` 边界内，并明确要求替换 Logo、商标、图片和原文。

代码包、Render IR 和源截图使用私有 Storage；只有数据库中 `published` 且 `RemixArtifact 2.0` 全部门禁通过的记录，才可经短期签名地址交付。编译器 API Key 只存在于服务端。完整约束、部署与真实基准见 [`REMIX_COMPILER.md`](REMIX_COMPILER.md)。

## 性能边界

- 首页 SSR，每页 12 条；36 条后启用固定行高虚拟列表。
- 前两张图片优先，其余图片懒加载；尺寸固定，避免 CLS。
- Supabase 浏览器 SDK、移动 Sheet 和虚拟列表按需加载。
- `pnpm performance:budget` 在构建后检查首页业务 JavaScript，预算 180 KiB gzip。
- 详情页先显示审核截图；只有可嵌入站点才加载受限 iframe，8 秒失败回退。
- 根布局接入 Vercel Speed Insights，用正式流量持续验证 LCP、INP 与 CLS；隐私说明同步披露汇总性能数据。

## 运行健康

- Next.js：`GET /api/health`。本地无依赖时返回 `mode=demo`；生产缺少数据、分析或治理配置、使用占位/私网 URL 或短共享密钥时返回 503。
- Cloudflare Worker：`GET /health`。配置无效时拒绝新任务，Queue 中已有消息转入延迟重试。
- 健康响应不返回密钥或完整提交 SHA。

## 可重复发布门禁

- Supabase CLI 版本固定在根项目中；`supabase/config.toml` 与 migration 一同入库，本地用 `db reset` 从空库重放。
- `pnpm check:release` 覆盖应用测试/类型/构建/性能预算、Peer 依赖和 Worker 无发布干跑。
- GitHub Actions 在 Pull Request 和 `main` 推送时执行相同门禁；数据库 migration 另在本地及独立 Preview Supabase 项目验证，避免 CI 持有生产数据库权限。
