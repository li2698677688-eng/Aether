# DesignFeed Remix Compiler 2.0

## 决策

DesignFeed 的核心复刻链路不再把截图或 DesignSpec 转成一段长自然语言，然后要求 AI 从零猜页面。截图仍用于展示与质量比较，DesignSpec 仍用于理解设计规律；真正交付给 AI 的起点是经过浏览器采集、确定性代码生成、构建和多视口验证的可运行代码包。

编译层复用 MIT 许可的 [`ion-design/ditto.site`](https://github.com/ion-design/ditto.site)，固定到已审计提交：

```text
3860a1a3a340069eabbfc550fd49807dd10f4f2c
```

不要在生产环境跟随浮动 `main`。升级提交前必须重跑本页列出的真实站点基准和 DesignFeed 全部门禁。

## 为什么不是截图转 Prompt

单张截图不能可靠提供：真实 DOM 层级、精确计算样式、字体文件与字重、盒模型、Flex/Grid 约束、断点变化、不可见状态、悬浮/焦点/展开状态、动效、资源映射和浏览器最终布局。因此 `DesignSpec 1.0 → Remix Prompt 1.0` 只能作为设计方向说明，不能作为“90% 复刻”的交付物。

2.0 链路使用以下证据：

```text
公开 URL
  → 375 / 768 / 1280 / 1920 多视口浏览器采集
  → DOM + bbox + computed styles + CSS variables + fonts + assets + interactions + motion
  → 归一化 Render IR
  → 确定性 Next.js 代码包
  → build + render + DOM/style/layout/responsive/interaction/motion gates
  → 每个视口像素比较
  → RemixArtifact 2.0 + .tgz
  → 短 Remix Launcher Prompt
```

AI 收到 Launcher 后应下载并校验现成代码包，在它上面替换品牌和业务内容；不得退回到凭自然语言或单图从零生成。

## 发布硬门槛

公开的百分比是“最差必需视口的视觉相似度”，不是加权平均，也不是模型自评：

```text
viewportSimilarity = 1 - pixelDiffRatio
publishedSimilarity = min(375, 768, 1280, 1920)
```

发布必须同时满足：

- 四个必需视口都存在，且每个 `viewportSimilarity >= 0.90`。
- 像素遮罩比例不超过 1%；当前实现固定为 0，不允许通过大面积忽略区域“刷分”。
- build、capture、assets/fonts、DOM、style、layout、responsive、determinism、interaction、motion 和 pollution 门禁全部通过。
- 代码包的 SHA-256 与 Manifest 一致。
- 只采集公开可访问的渲染表面；不包含原站可执行脚本，不复刻登录、支付或凭据收集流程。
- 管理员审核通过前，代码包、Render IR 与源截图保持私有。

数据库触发器会拒绝发布缺少代码包、证据或最差视口低于 90% 的记录。上游编译器的综合 `scorecard.total` 不参与这个判定。

## 真实基准（2026-08-06）

| 网站 | 最差视觉相似度 | DOM | 样式 | 布局 | DesignFeed 判定 |
| --- | ---: | ---: | ---: | --- | --- |
| `https://sive.rs/` | 96.00%（375） | 100% | 100% | 中位误差 0.80–0.86px；通过 | 通过 |
| `https://supabase.com/` | 97.34%（375） | 100% | 95.17% | 375px 叶节点尺寸通过率 91.84%，低于 92% 门槛 | 拒绝 |
| `https://www.gov.uk/` | 86.16%（768） | 文本存在 99.05%，低于 100% 门槛 | 99.74% | 768/1280/1920 高度与区块边界偏差过大 | 拒绝 |

Supabase 的上游综合分为 99.1，但布局门禁失败，因此 DesignFeed 必须拒绝。这正是 2.0 不展示“漂亮综合分”的原因。该次采集还发现 27 个视觉资源无法下载；它们必须通过重新采集、合法替代资源或人工修复解决后再进入发布。

GOV.UK 的上游综合分为 91.9，但 768px 像素差为 13.84%（相似度 86.16%），DOM 与布局也失败，DesignFeed 同样拒绝。另一次 `https://resend.com/` 实测因高成本 Canvas 在限定窗口内无法稳定完成四视口采集，被归类为“不支持/需人工处理”，不生成虚假分数。

基准报告保存在本机临时验证目录，不提交第三方网站资产：

```text
/tmp/designfeed-remix-benchmark-sivers/sive/.clone/validation/report.json
/tmp/designfeed-remix-benchmark-supabase/supabase/.clone/validation/report.json
/tmp/designfeed-remix-benchmark-govuk/gov/.clone/validation/report.json
```

## 自托管编译器

编译器需要长时间运行的 Node/Playwright Worker，不能塞进 Vercel 页面请求或 Cloudflare Browser Rendering Worker。生产建议按上游文档部署两项服务：

- API：轻量 REST/MCP 服务。
- Worker：Playwright 采集、生成、构建与验证。
- Neon/Postgres：任务与队列。
- Cloudflare R2 或 S3：编译产物。

上游部署说明：[`docs/DEPLOY.md`](https://github.com/ion-design/ditto.site/blob/main/docs/DEPLOY.md)。部署时至少设置：

```text
VERIFY_TIER=easy
API_KEYS=<至少 32 字符的随机密钥>
RATE_LIMIT_PER_MINUTE=<合理限额>
DATABASE_URL=<队列数据库>
S3_BUCKET / S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
```

DesignFeed 与 Cloudflare Worker 同时配置：

```text
REMIX_COMPILER_URL=https://compiler.your-domain.com
REMIX_COMPILER_API_KEY=<与编译器一致>
REMIX_COMPILER_REVISION=3860a1a3a340069eabbfc550fd49807dd10f4f2c
SUPABASE_PRIVATE_REMIX_BUCKET=remix_artifacts_private
```

仓库内的 [`services/remix-compiler/`](../services/remix-compiler/) 提供可复现镜像和 Cloudflare Containers 入口：镜像只拉取上述固定 commit，校验 SHA 后应用版本化安全补丁。补丁不修改采集或生成算法，只升级 Hono、Node adapter、MCP SDK、`fast-uri` 与 `ip-address`，关闭在固定 commit 发布后披露的 URL/主机解析与 SSRF 风险。补丁已通过上游全 workspace typecheck、编译器 575 项测试、API/鉴权/SSRF、Core、Storage 和 Worker 真实 build+gate 测试；`npm audit --omit=dev` 为 0 漏洞。

Cloudflare Containers 仅在 Workers Paid 计划可用。当前账号仍是 Free，因此仓库已做到可部署但没有擅自开通每月付费计划。容器初始模式使用单实例内存队列，适合受控试运行；公开高并发上线前仍要切换到上游 Postgres/pg-boss + R2 的持久化双服务模式。

## API 契约端到端验证（2026-08-06）

固定 commit + 安全补丁的真实 API 已在本机启动，并通过 DesignFeed 自己的 `createRemixCompilerClient` 完成：提交 URL、异步轮询、读取原始验证报告、按最差视口执行硬门槛、下载 `.tgz` 和 SHA-256 校验。测试页面结果：

| 视口 | 视觉相似度 | 布局中位误差 |
| ---: | ---: | ---: |
| 375 | 99.85% | 0px |
| 768 | 100% | 0px |
| 1280 | 100% | 0.01px |
| 1920 | 100% | 0.01px |

11 项 DesignFeed 门禁全部通过，下载包为 10,393 字节，SHA-256 为 `38ebf3fb346d6a58005190123b942b0aaad92a7a81e294a68cfcbaf624f0784f`。轮询期间实际观察到一次瞬时 `ECONNRESET`；任务本身已成功，因此客户端增加了有上限的网络/408/425/429/500/502/503/504 重试，401 等鉴权错误仍立即失败，并有回归测试覆盖。

`KIMI_API_KEY` 只负责生成便于阅读的 DesignSpec，不参与确定性代码生成和 90% 质量判定；没有 Kimi 时，核心编译器仍应能够生成和验证代码包。

## 支持边界

“任意网站”在工程上指公开可访问且浏览器能稳定渲染的页面表面。登录后内容、付费墙、验证码、反自动化拦截、按用户个性化、DRM 视频、第三方私有接口和持续变化的 WebGL/实时数据不能诚实承诺 90%。遇到这些情况必须显示明确的“不支持/需人工处理”，不能用截图或伪造内容冒充成功。

## 上游方法与评估参考

- [ditto.site 方法论](https://github.com/ion-design/ditto.site/blob/main/docs/METHODOLOGY.md)
- [ditto.site Responsible Use](https://github.com/ion-design/ditto.site/blob/main/docs/RESPONSIBLE_USE.md)
- [Design2Code benchmark](https://github.com/NoviScl/Design2Code)
- [Design2Code paper](https://arxiv.org/abs/2403.03163)
- [VisRefiner](https://arxiv.org/abs/2602.05998)
- [VISTA](https://arxiv.org/abs/2605.26144)
