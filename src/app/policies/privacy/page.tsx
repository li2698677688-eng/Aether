import type { Metadata } from "next";

import { PolicyPage } from "@/components/community/policy-page";

export const metadata: Metadata = { title: "隐私说明", description: "DesignFeed 如何处理账号、投稿、收藏和采集数据。" };

export default function PrivacyPage() {
  return <PolicyPage
    eyebrow="Privacy"
    intro="DesignFeed 只收集完成登录、投稿、审核和私人收藏所必需的数据，不出售个人信息，也不会把私人收藏公开到个人主页。"
    sections={[
      { title: "我们处理的数据", paragraphs: ["登录服务会处理邮箱、Google 账号标识和基础头像资料；投稿会保存网址、任务状态和提交者；收藏只对当前账号可见。"], bullets: ["网站截图、结构化提取结果与管理员审核记录", "用于防止滥用的任务次数、失败代码与时间信息", "页面路由、设备类别与 Core Web Vitals 等汇总性能数据", "必要的认证 Cookie；不在浏览器中保存服务端密钥"] },
      { title: "使用目的与保留", paragraphs: ["这些数据用于提供账号功能、异步采集、内容审核、故障诊断和下架处理。审核日志按安全与争议处理需要保留；被驳回或下架内容可在合理期限后删除。"] },
      { title: "第三方服务", paragraphs: ["Supabase 提供账号、数据库和私有截图存储；Cloudflare 执行隔离采集；Moonshot AI（Kimi）或 OpenAI 把经过边界控制的页面证据转换为 DesignSpec；Vercel 托管应用并通过 Speed Insights 汇总 Core Web Vitals。密钥只放在各自的服务端环境中。"] },
      { title: "你的权利", paragraphs: ["你可以请求查看、更正或删除与账号关联的数据，也可以对被收录网站提出下架请求。申请时只需提供核验权利归属所需的最少材料。"] },
    ]}
    title="隐私说明"
  />;
}
