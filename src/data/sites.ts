import type { DesignSpec, Site, SiteCategory } from "@/types/site";

interface SeedSite {
  slug: string;
  title: string;
  url: string;
  category: SiteCategory;
  summary: string;
  accent: string;
  tags: string[];
  mood: string[];
}

function createDesignSpec(site: SeedSite, index: number): DesignSpec {
  const generatedAt = new Date(Date.UTC(2026, 7, Math.max(1, 5 - (index % 5)), 9, 0)).toISOString();
  const extracted = { source: "extracted" as const, confidence: 0.94 };
  const inferred = { source: "inferred" as const, confidence: 0.78 };

  return {
    version: "1.0",
    generatedAt,
    overview: {
      description: site.summary,
      mood: site.mood,
      useCases: [site.category, "产品展示", "品牌表达"],
    },
    typography: [
      { name: "Display", value: "Inter / 64px / 600 / 0.96", usage: "首屏主标题", ...inferred },
      { name: "Body", value: "Inter / 16px / 400 / 1.55", usage: "正文与说明", ...inferred },
      { name: "Label", value: "Inter / 12px / 600 / 1.2", usage: "导航和标签", ...inferred },
    ],
    colors: [
      { name: "Accent", value: site.accent, usage: "品牌强调和关键操作", ...extracted },
      { name: "Canvas", value: "#F7F7F5 / #090909", usage: "页面背景", ...extracted },
      { name: "Ink", value: "#111111 / #F5F5F5", usage: "主文本", ...extracted },
    ],
    layout: [
      { name: "Container", value: "max 1440px", usage: "桌面内容边界", ...inferred },
      { name: "Grid", value: "12 columns / 24px gutter", usage: "模块排列", ...inferred },
      { name: "Breakpoints", value: "390 / 768 / 1024 / 1440", usage: "响应式变化", ...inferred },
    ],
    spacing: [
      { name: "Space scale", value: "4 / 8 / 12 / 16 / 24 / 32 / 48", usage: "间距体系", ...inferred },
    ],
    radius: [
      { name: "Surface", value: "12px", usage: "卡片和浮层", ...extracted },
      { name: "Control", value: "8px", usage: "按钮和输入框", ...extracted },
    ],
    shadows: [
      { name: "Floating", value: "0 12px 36px rgba(0,0,0,.12)", usage: "悬浮菜单", ...inferred },
    ],
    components: [
      {
        name: "PrimaryAction",
        intent: "承载当前页面唯一的主要下一步",
        props: ["label: string", "icon?: ReactNode", "disabled?: boolean", "onPress: () => void"],
        variants: ["solid", "inverse"],
        states: ["default", "hover", "focus", "disabled"],
        tokens: ["Accent", "Control"],
        useWhen: "页面需要明确推进用户完成主要任务",
        avoidWhen: "同一区域已经存在一个主要操作",
        example: "开始使用 / 创建项目",
        validation: "每个视觉区域最多出现一个主要操作",
        ...inferred,
      },
      {
        name: "FeaturePanel",
        intent: "组合展示一组强关联的产品能力",
        props: ["title: string", "description: string", "media?: ReactNode", "href?: string"],
        variants: ["plain", "media", "outlined"],
        states: ["default", "hover"],
        tokens: ["Canvas", "Surface", "Space scale"],
        useWhen: "内容需要被快速扫描和比较",
        avoidWhen: "信息只有一句话或不需要分组",
        example: "功能说明 + 截图 + 辅助链接",
        validation: "标题层级、图片比例和操作位置必须一致",
        ...inferred,
      },
    ],
    motion: ["进入动效控制在 160–240ms", "只对 opacity 与 transform 做动画", "减少动态效果时立即完成"],
    accessibility: ["正文对比度至少 4.5:1", "所有图标按钮提供可访问名称", "焦点顺序与视觉顺序一致"],
    responsiveNotes: ["移动端改为单列", "首屏字号收敛约 36%", "导航折叠为抽屉并保留主要操作"],
  };
}

const seeds: SeedSite[] = [
  { slug: "vercel", title: "Vercel", url: "https://vercel.com/", category: "SaaS", summary: "面向 AI 应用与现代 Web 的克制型产品首页。", accent: "#111111", tags: ["开发者工具", "极简"], mood: ["精确", "理性", "编辑感"] },
  { slug: "supabase", title: "Supabase", url: "https://supabase.com/", category: "数据面板", summary: "以产品模块和技术信任感组织的开发者平台。", accent: "#3ECF8E", tags: ["数据库", "开发者工具"], mood: ["清晰", "技术感", "可信"] },
  { slug: "raycast", title: "Raycast", url: "https://www.raycast.com/", category: "移动产品", summary: "以高对比暗色和强产品截图建立效率工具气质。", accent: "#FF6363", tags: ["效率", "暗色"], mood: ["快速", "锐利", "沉浸"] },
  { slug: "clerk", title: "Clerk", url: "https://clerk.com/", category: "SaaS", summary: "大字号信息层级与轻量产品线框结合的身份平台。", accent: "#6C47FF", tags: ["身份验证", "B2B"], mood: ["友好", "可靠", "现代"] },
  { slug: "resend", title: "Resend", url: "https://resend.com/", category: "落地页", summary: "用编辑字体与低照度画面塑造高级开发者品牌。", accent: "#FFFFFF", tags: ["邮件", "编辑设计"], mood: ["安静", "高级", "专注"] },
  { slug: "framer", title: "Framer", url: "https://www.framer.com/", category: "AI/对话", summary: "把 AI 生成体验直接置于首屏的设计工具首页。", accent: "#5B5BFF", tags: ["网站构建", "AI"], mood: ["未来", "直接", "创作"] },
  { slug: "pitch", title: "Pitch", url: "https://pitch.com/", category: "作品集", summary: "以强品牌色和动态演示展示 AI 幻灯片体验。", accent: "#B69CFF", tags: ["演示", "AI"], mood: ["活力", "流动", "表达"] },
  { slug: "webflow", title: "Webflow", url: "https://webflow.com/", category: "落地页", summary: "采用大型价值主张与模块化能力入口的网站平台。", accent: "#146EF5", tags: ["网站构建", "增长"], mood: ["有力", "清楚", "商业"] },
  { slug: "stripe", title: "Stripe", url: "https://stripe.com/", category: "个人/品牌", summary: "高密度文案、彩色品牌图形和全球信任标识的组合。", accent: "#635BFF", tags: ["金融", "品牌"], mood: ["可信", "全球化", "精致"] },
  { slug: "notion", title: "Notion", url: "https://www.notion.com/product", category: "SaaS", summary: "使用强观点标题与纪实影像传达团队协作价值。", accent: "#2383E2", tags: ["协作", "AI"], mood: ["人文", "开放", "克制"] },
  { slug: "cal", title: "Cal.com", url: "https://cal.com/", category: "SaaS", summary: "以实际预约界面作为首屏主体的开源调度产品。", accent: "#292929", tags: ["开源", "日程"], mood: ["实用", "清爽", "稳健"] },
  { slug: "spline", title: "Spline", url: "https://spline.design/", category: "实验性网页", summary: "面向实时 3D 创作的空间化产品展示网站。", accent: "#B4FF39", tags: ["3D", "创作工具"], mood: ["空间", "实验", "趣味"] },
  { slug: "buffer", title: "Buffer", url: "https://buffer.com/", category: "SaaS", summary: "面向内容团队的轻量、友好型社交媒体工作台。", accent: "#2C4BFF", tags: ["社交媒体", "内容"], mood: ["亲和", "清晰", "轻量"] },
  { slug: "contra", title: "Contra", url: "https://contra.com/", category: "作品集", summary: "以作品瀑布流和强人才品牌感构建的自由职业平台。", accent: "#E8FF59", tags: ["自由职业", "作品"], mood: ["大胆", "年轻", "社群"] },
  { slug: "openai", title: "OpenAI", url: "https://openai.com/", category: "AI/对话", summary: "通过留白、强影像和编辑排版建立研究品牌权威。", accent: "#111111", tags: ["AI", "研究"], mood: ["思辨", "克制", "前沿"] },
  { slug: "anthropic", title: "Anthropic", url: "https://www.anthropic.com/", category: "AI/对话", summary: "温暖纸张色与长文阅读节奏结合的 AI 研究网站。", accent: "#D97757", tags: ["AI", "研究"], mood: ["人文", "温暖", "理性"] },
  { slug: "ramp", title: "Ramp", url: "https://ramp.com/", category: "数据面板", summary: "用数据结果、社会证明和高密度界面服务企业采购决策。", accent: "#39FF88", tags: ["金融", "企业"], mood: ["高效", "可信", "数据化"] },
  { slug: "readme", title: "ReadMe", url: "https://readme.com/", category: "个人/品牌", summary: "带有温度和故事性的开发者文档品牌网站。", accent: "#018EF5", tags: ["文档", "开发者工具"], mood: ["友好", "专业", "叙事"] },
  { slug: "basecamp", title: "Basecamp", url: "https://basecamp.com/", category: "个人/品牌", summary: "用插画、直接文案和真实价值观建立长期产品品牌。", accent: "#2DA44E", tags: ["协作", "品牌"], mood: ["诚实", "亲切", "成熟"] },
  { slug: "planetscale", title: "PlanetScale", url: "https://planetscale.com/", category: "数据面板", summary: "高对比技术视觉与数据库产品能力结合的开发者网站。", accent: "#F59E0B", tags: ["数据库", "基础设施"], mood: ["精准", "强劲", "技术感"] },
];

export const featuredSites: Site[] = seeds.map((site, index) => ({
  ...site,
  id: `site-${String(index + 1).padStart(2, "0")}`,
  featured: index < 6,
  publishedAt: new Date(Date.UTC(2026, 7, 5 - Math.floor(index / 4), 8, index)).toISOString(),
  capturedAt: new Date(Date.UTC(2026, 7, 5, 7, index)).toISOString(),
  author: index % 3 === 0 ? "DesignFeed 编辑部" : "社区投稿",
  embedStatus: "screenshot_only",
  status: "published",
  designSpec: createDesignSpec(site, index),
}));

export function getSiteBySlug(slug: string) {
  return featuredSites.find((site) => site.slug === slug);
}
