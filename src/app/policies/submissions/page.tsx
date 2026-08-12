import type { Metadata } from "next";

import { PolicyPage } from "@/components/community/policy-page";

export const metadata: Metadata = { title: "投稿规则", description: "DesignFeed 网站投稿、采集、审核与 Remix 使用边界。" };

export default function SubmissionPolicyPage() {
  return <PolicyPage
    eyebrow="Submission policy"
    intro="投稿代表推荐公开可访问的网站进入审核队列，不代表投稿者拥有该网站。所有截图、DesignSpec 和 Remix 代码产物都必须经过管理员审核后才会公开。"
    sections={[
      { title: "可以提交什么", paragraphs: ["只接受公开、合法且适合设计研究的 http/https 网站。请勿提交登录后私密页面、内网地址、违法内容、恶意下载或明显侵犯他人权利的页面。"] },
      { title: "采集与审核", paragraphs: ["系统会在多个视口采集 DOM、计算样式、布局、资源与截图证据，并把页面提取与 AI 推断分别标注。普通账号每天最多投稿 3 个，同时最多保留 5 个待处理任务。"], bullets: ["动态内容可能导致证据与原站当前状态不同", "不允许嵌入的网站只展示审核截图", "管理员可以修订分类和 DesignSpec，检查 Remix 代码包与逐视口质量，或驳回、重试任务"] },
      { title: "Remix 边界", paragraphs: ["Remix 交付经过校验的参考代码包，不把截图提示词冒充成精确复刻。使用者必须替换原网站的 Logo、商标、专有图片和原文，不得借此冒充原品牌、收集凭据或规避知识产权规则。"] },
      { title: "移除与重复内容", paragraphs: ["权利人可以从任一网站详情页发起下架申请。重复网址会被拒绝；已下架内容在问题解决前不会重新发布。"] },
    ]}
    title="投稿规则"
  />;
}
