import type { Metadata } from "next";

import { ExternalLink } from "lucide-react";

import { CommunityShell } from "@/components/community/community-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "申请下架", description: "申请移除 DesignFeed 收录的网站、截图或设计规范。" };

export default async function RemovalRequestPage({ searchParams }: { searchParams: Promise<{ site?: string | string[] }> }) {
  const params = await searchParams;
  const site = Array.isArray(params.site) ? params.site[0] : params.site;
  const contact = process.env.REMOVAL_CONTACT_EMAIL?.trim();
  const subject = `DesignFeed 下架申请${site ? `：${site}` : ""}`;
  const body = ["收录页面：", site || "", "", "申请人及与网站的关系：", "", "希望移除的内容与原因：", "", "可用于核验权利归属的公开信息："].join("\n");
  const mailto = contact ? `mailto:${contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : undefined;

  return (
    <CommunityShell>
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Content removal</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">申请下架</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">如果你是网站权利人、品牌代表或内容创作者，可以申请移除截图、DesignSpec、Remix 代码产物或整条收录。我们会先隐藏存在明确风险的内容，再核验并处理。</p>
        {site && <div className="mt-6 rounded-lg border bg-muted/30 px-3 py-2 text-sm"><span className="text-muted-foreground">申请对象：</span>{site}</div>}
        <section className="mt-10 border-t pt-8" id="requirements">
          <h2 className="text-lg font-semibold">请提供这些最少信息</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
            <li>DesignFeed 详情页或原网站的完整 URL。</li>
            <li>你与网站、品牌或内容的关系。</li>
            <li>需要移除的范围和原因；不必发送身份证件等无关敏感材料。</li>
            <li>可公开核验的官网联系人、DNS 记录或其他权利证明。</li>
          </ol>
          {mailto ? (
            <a className={cn(buttonVariants(), "mt-6")} href={mailto}>发起下架申请 <ExternalLink aria-hidden="true" /></a>
          ) : (
            <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">下架联系邮箱尚未在当前环境配置。上线前必须设置 <code>REMOVAL_CONTACT_EMAIL</code>。</p>
          )}
        </section>
        <section className="mt-10 border-t pt-8">
          <h2 className="text-lg font-semibold">处理方式</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">收到完整材料后会记录申请、核验对象并通知处理结果。紧急的隐私、安全或明确侵权风险会优先隐藏；有争议的请求可能需要补充最小必要证明。</p>
        </section>
      </article>
    </CommunityShell>
  );
}
