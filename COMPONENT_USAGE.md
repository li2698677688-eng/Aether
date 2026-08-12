# DesignFeed Component Usage

## 基础组件

- `Button`：所有按钮和图标操作；主操作用 `default`，次操作用 `outline`，低权重操作用 `ghost`。
- `Input / Textarea / Select`：投稿、搜索和审核编辑；必须有可访问名称和错误信息。
- `Card`：设计规范模块、状态模块；Feed 封面卡可在其上扩展，但不得复制一套按钮实现。
- `Sheet`：移动端筛选抽屉。
- `Tabs`：详情页“设计规范 / 仅预览”和桌面/手机预览切换。
- `ResizablePanelGroup`：桌面详情分栏；范围固定在预览 45%–80%，键盘可调。
- `Badge`：分类、来源和置信度，不仅依赖颜色表达状态。
- `Dialog`：登录提示、投稿结果和管理员拒绝原因。

## 业务组件边界

- `SiteCard` 只负责网站封面、元信息和收藏入口，不拉取数据。
- `FeedShell` 负责 URL 搜索参数、筛选、分页和移动端抽屉。
- `FeedSidebar` 只承载搜索、分类和投稿主操作，不放账户导航，也不重复提供“全部 / 最新 / 收藏”内容视图。
- `CommunityNav` 统一承载收藏、登录、我的投稿、公开个人主页和管理员审核；桌面端固定在内容区右上角，移动端收进右上角账户抽屉。
- `FeedSidebar` 选项状态统一复用 shadcn `Button`：未选中用 `ghost`（透明底），悬浮用语义化 `muted`，选中用 `default`（浅色主题黑底白字、深色主题反转）；筛选按钮必须用 `aria-pressed` 暴露选中状态，并保留 Button 自带的 focus-visible、active、disabled 状态。
- `SubmitPage` 使用单列阅读顺序：标题与说明在上，投稿 Card 在下；桌面端不得回退为左右分栏。
- `DesignSpecPanel` 只消费版本化 `DesignSpec`，不直接使用 AI 原始文本。
- `RemixButton` 固定悬浮在 `DesignSpecPanel` 底部，中文按钮名为“复刻”，英文功能名为 `Remix`；只有 `RemixArtifact 2.0` 已通过全部门禁时才允许访客无需登录复制 Launcher。缺少产物或任一视口低于 90% 时必须显示不可用，不得回退成截图提示词。
- `RemixArtifact 2.0` 是 AI 可读、可运行的复刻契约：交付确定性代码包、SHA-256、Render IR、四个源视口和逐视口质量报告。短 Launcher 只负责让 AI 下载并校验代码包，不负责让 AI 根据文字猜页面。
- `RemixArtifactReview` 允许管理员检查最差视口、全部源截图、逐视口分数、质量门禁、预览、Manifest、Render IR 与代码包；管理员明确确认前不得发布。
- `DesignSpecReview` 只接受通过 `DesignSpec 1.0` Schema 的 JSON；它负责解释设计规律，不是 90% 复刻的代码来源，也不能替代 Remix 产物审核。
- `LazySheet` 是首页移动抽屉的按需边界；触发按钮先渲染，只有打开账户或筛选时才下载 shadcn Sheet，关闭后焦点返回触发按钮。
- `SitePreview` 始终把审核截图作为固定尺寸占位和失败回退；当 `embedStatus=embeddable` 时默认在其上自动加载受限 iframe，真实网页加载完成后再淡入，桌面/手机切换时重建对应视口。加载报错或 8 秒超时必须回退截图；`screenshot_only` 不得尝试嵌入，并提供“原站”出口。
- `PolicyPage` 只承载隐私和投稿规则正文；每个详情页必须保留带原站 URL 的下架入口，不能只在网站页脚提供泛化链接。

## 校验规则

- 不允许直接写原生按钮代替 `Button`。
- 不允许新增与语义 Token 重复的十六进制颜色。
- 不允许用手绘 SVG、字符或 emoji 冒充图标；统一使用项目的 Lucide 图标入口。
- 所有列表图片必须声明尺寸或固定比例，并提供 `sizes` 与懒加载策略。
- 首页不得静态导入 Supabase 浏览器 SDK、虚拟列表或移动 Sheet；`pnpm performance:budget` 必须通过。
