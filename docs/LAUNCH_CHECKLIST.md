# DesignFeed Launch Checklist

当前执行记录（2026-08-06）：生产 Supabase 的 10 条 migration 已登记，私有 Remix Bucket 与数据库发布门已烟测；Vercel Preview 已成功构建，但健康检查仍因编译器未部署而显示 `analysis=false`。因此尚未进入本清单第 5 节的生产切流。

## 1. Supabase

- 本地先运行 `pnpm db:start && pnpm db:reset && pnpm db:lint`，确认全部 migration 可从空数据库重放且无 lint warning。
- 创建独立 Preview 项目，执行 `supabase link --project-ref <preview-ref>` 和 `supabase db push --dry-run`，确认目标正确后再执行 `supabase db push`；不要对生产运行 `db reset`。
- 新建生产项目并依次执行：
  1. `202608050001_initial_designfeed.sql`
  2. `202608050002_completion_workflow.sql`
  3. `202608050003_private_screenshots.sql`
  4. `202608050004_atomic_analysis_callback.sql`
  5. `202608050005_analysis_job_events.sql`
  6. `202608050006_atomic_moderation.sql`
  7. `202608050007_submission_concurrency.sql`
  8. `202608050008_api_privileges.sql`
  9. `202608060001_remix_artifact_v2.sql`
  10. `202608060002_remix_artifact_moderation.sql`
- 确认 `site-screenshots-private` 与 `remix_artifacts_private` Bucket 都是私有，公开 Bucket 策略已删除。
- 在 Auth 中启用邮箱 OTP 和 Google，回调地址设置为 `https://<domain>/auth/callback`。
- 创建首个用户后，只在 SQL Editor 中把该用户的 `profiles.role` 改为 `admin`；不要把角色修改能力开放给客户端。
- 用匿名、普通用户和管理员分别验证 RLS。

## 2. Cloudflare

- 部署前运行 `pnpm worker:dry-run`，确认绑定和构建无误。
- 创建 `designfeed-analysis` Queue 和 `designfeed-analysis-dlq`。
- 把 `workers/analyzer/wrangler.jsonc` 中的 `APP_BASE_URL` 换成测试环境 HTTPS 域名；示例域名、HTTP、私网地址会使 Worker 返回 503 且拒绝入队。
- 分别生成至少 32 个字符的随机 `ANALYSIS_ENQUEUE_SECRET`、`ANALYSIS_CALLBACK_SECRET`（不可复用），并与 Vercel 同名值一致。
- 部署 Worker，确认 `GET /health` 返回 200，再把 `/enqueue` 地址写入 Vercel 的 `ANALYSIS_ENQUEUE_URL`。
- 先按 [`REMIX_COMPILER.md`](REMIX_COMPILER.md) 和 [`services/remix-compiler/`](../services/remix-compiler/) 的固定提交部署 API、Worker、队列数据库与对象存储，再设置 `REMIX_COMPILER_URL`、API Key 和 Revision；不得直接部署未打安全补丁的上游 commit。
- 使用一个公开测试站点验证 DNS/重定向保护、四张展示截图、四视口 Render IR、私有直传、DesignSpec、编译器验证和回调。

## 3. Vercel

- 导入仓库并配置 `.env.example` 中全部生产变量；`REMOVAL_CONTACT_EMAIL` 必须是真实有人处理的邮箱。
- 使用 Kimi 时设置 `DESIGN_AI_PROVIDER=kimi`、`KIMI_API_KEY`、官方 `KIMI_API_BASE_URL` 和 `KIMI_DESIGN_MODEL`；不要同时填写无用的 OpenAI Key，也不要把 Key 写入仓库或 `NEXT_PUBLIC_` 变量。
- Preview 和 Production 使用不同 Supabase 项目或至少不同数据集；密钥不得复用到本地示例文件。
- 部署 Preview 后确认 `/api/health` 返回 200、`mode=cloud`、所有 checks 为 `true`；占位域名、HTTP/私网服务地址、短共享密钥或示例下架邮箱都会按设计返回 503。
- 在项目的 Speed Insights 页面点击 Enable；部署后确认正式域名产生 LCP、INP、CLS 数据。
- 运行 `pnpm check`；记录构建 SHA 和 Lighthouse 结果。
- 合并前确认 GitHub Actions 的 `Quality / release-gate` 通过。

## 4. 发布验收

- 真实走通：注册/登录 → 投稿 → Queue → 多视口证据 → DesignSpec + 代码包 → 最差视口与全部门禁 → 管理员逐项审核 → 发布 → 访客下载并校验代码包。
- 人为删除一个门禁、一个源截图、一个私有路径并把最差视口降到 89.99%，确认 API 与数据库四种情况都拒绝发布。
- 验证重复投稿、每日 3 条、最多 5 个待处理、3 次重试和失败人工重试。
- 验证访客不能读取待审核站点/截图，普通用户看不到他人收藏/任务，非管理员不能调用审核接口。
- 在 1440、1280、1024、390 宽度检查 Feed、投稿、详情、审核和移动抽屉。
- 键盘完成搜索、分类、移动抽屉、详情 Tab、分栏调整、复刻与弹窗关闭；开启“减少动态效果”复查。
- 移动 4G 实测目标：LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1；首页业务 JavaScript ≤ 180 KiB gzip。
- 通过真实审核流程录入约 20 个公开网站，覆盖全部分类；不得直接把未审核种子写成 `published`。
- 检查隐私说明、投稿规则和每个详情页的下架入口；发送一次真实下架测试邮件。

## 5. 切换生产

- 冻结内容结构变更，保留最近一个已验证 Vercel Deployment 和 Worker Version。
- 切换正式域名后更新 Supabase OAuth 回调、Worker `APP_BASE_URL`、CSP 所需域名和健康监控地址。
- 观察至少 30 分钟：5xx、健康检查、Queue backlog、DLQ、截图失败率、AI 延迟和 Web Vitals。

## 回滚

1. 内容问题：先把目标站点改为 `rejected`/下架，不回滚整个应用。
2. Next.js 回归：在 Vercel Promote 上一个已验证 Deployment；数据库迁移保持向前兼容，不执行破坏性回滚。
3. Worker 回归：回滚到上一个 Cloudflare Version，暂停 Queue consumer；不要删除消息。
4. 密钥泄漏：先轮换对应密钥，再重新部署 Vercel/Worker，检查回调防重放记录和审核日志。
5. 数据异常：停止审核发布，导出受影响 ID 和 moderation logs，使用 Supabase PITR/备份恢复到新实例后比对，不直接覆盖生产。
