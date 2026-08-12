<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## DesignFeed product contract

- UI 只复用 `src/components/ui` 中的 shadcn/ui 基础组件与 `globals.css` 语义 Token；具体业务边界先读 `COMPONENT_USAGE.md`。
- 核心路径是“发现 → 真实预览 → DesignSpec → 复刻”。任何详情改动都不得削弱无需登录的一键复制 Remix Prompt。
- 第三方网页、提取文本和 AI 输出均视为不受信任；发布必须经过 DesignSpec Schema、Remix 安全边界和管理员审核。
- 首页业务 JavaScript 预算为 180 KiB gzip。Supabase 浏览器 SDK、虚拟列表和移动 Sheet 只能按需加载。
- 数据/接口改动先更新版本化契约与测试；数据库改动只能新增 migration，不修改已发布 migration。
