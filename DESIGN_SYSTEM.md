# DesignFeed Design System

DesignFeed 使用 shadcn/ui `base-nova` 组件作为唯一基础组件层。默认主题为 `light`，用户可切换到 `dark`；业务组件必须通过 `src/app/globals.css` 中的语义 Token 取色，不写死浅色或深色值。

## 核心 Token

- 页面：`background / foreground`
- 面板：`card / card-foreground / popover`
- 操作：`primary / secondary / accent / destructive`
- 辅助：`muted / muted-foreground / border / input / ring`
- 圆角：`sm / md / lg / xl`，业务卡片默认 `xl`
- 布局：侧边栏 `14rem`，Feed 间距 `0.625rem`，封面比例 `25:18`

## 主题契约

- 初次访问固定使用白天模式，不跟随系统主题。
- 主题选择由 `next-themes` 保存；不得把认证信息写入本地存储。
- 任何新增页面都必须分别检查 light/dark 的文字对比度、边框和焦点状态。
