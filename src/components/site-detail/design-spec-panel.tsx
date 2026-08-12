import { CheckCircle2, CircleAlert, Component, Grid3X3, Palette, ScanText, Sparkles } from "lucide-react";
import Link from "next/link";

import { EvidenceBadge } from "@/components/site-detail/evidence-badge";
import { RemixButton } from "@/components/site-detail/remix-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { safeColorPreview } from "@/lib/color-preview";
import type { DesignToken, Site } from "@/types/site";

function SectionTitle({ icon: Icon, children }: { icon: typeof ScanText; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-background">
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <h2 className="text-sm font-semibold tracking-[-0.01em]">{children}</h2>
    </div>
  );
}

function TokenRow({ token }: { token: DesignToken }) {
  return (
    <div className="grid gap-2 border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{token.name}</span>
        <EvidenceBadge confidence={token.confidence} source={token.source} />
      </div>
      <code className="text-xs text-muted-foreground">{token.value}</code>
      <p className="text-xs leading-5 text-muted-foreground">{token.usage}</p>
    </div>
  );
}

function TokenCard({ title, tokens }: { title: string; tokens: DesignToken[] }) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-0">
        {tokens.map((token) => <TokenRow key={`${title}-${token.name}`} token={token} />)}
      </CardContent>
    </Card>
  );
}

export function DesignSpecPanel({ site }: { site: Site }) {
  const spec = site.designSpec;
  if (!spec) return null;

  return (
    <div className="relative h-full overflow-hidden bg-muted/35">
      <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl px-5 pb-36 pt-7 sm:px-7 sm:pb-40 sm:pt-9">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{site.category}</Badge>
          <Badge variant="outline">DesignSpec {spec.version}</Badge>
          <span className="text-xs text-muted-foreground">
            采集于 {new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", year: "numeric" }).format(new Date(site.capturedAt ?? site.publishedAt))}
          </span>
        </div>
        <h2 className="mt-5 text-balance text-[clamp(2rem,4vw,3.65rem)] font-semibold leading-[0.96] tracking-[-0.055em]">
          {site.title} · 设计规范
        </h2>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">{spec.overview.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {spec.overview.mood.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
        </div>
        <section className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">适用场景</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {spec.overview.useCases.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
          </div>
        </section>

        <Separator className="my-7" />

        <section>
          <SectionTitle icon={ScanText}>字体体系</SectionTitle>
          <Card className="gap-0 overflow-hidden py-0 shadow-none">
            <CardContent className="grid gap-0 p-0 sm:grid-cols-2">
              {spec.typography.map((token, index) => (
                <div className="border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0" key={token.name}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{token.name}</p>
                    <EvidenceBadge confidence={token.confidence} source={token.source} />
                  </div>
                  <p className={index === 0 ? "mt-5 text-4xl font-semibold tracking-[-0.05em]" : "mt-5 text-lg"}>Inter</p>
                  <p className="mt-2 text-xs text-muted-foreground">{token.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="mt-7">
          <SectionTitle icon={Palette}>色彩 Token</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {spec.colors.map((token) => {
              const preview = safeColorPreview(token.value);
              return (
              <Card className="gap-0 py-0 shadow-none" key={token.name}>
                <div
                  className="flex min-h-28 items-end justify-between gap-3 bg-muted p-4 text-foreground"
                  style={preview ?? undefined}
                >
                  <span className="font-semibold">{token.name}</span>
                  <code className="text-xs">{token.value.split(" / ")[0]}</code>
                </div>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="text-xs text-muted-foreground">{token.usage}</span>
                  <EvidenceBadge confidence={token.confidence} source={token.source} />
                </CardContent>
              </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-7">
          <SectionTitle icon={Grid3X3}>布局与表面</SectionTitle>
          <div className="grid gap-2 xl:grid-cols-2">
            <TokenCard title="栅格与断点" tokens={spec.layout} />
            <TokenCard title="间距、圆角与阴影" tokens={[...spec.spacing, ...spec.radius, ...spec.shadows]} />
          </div>
        </section>

        <section className="mt-7">
          <SectionTitle icon={Component}>组件契约</SectionTitle>
          <div className="space-y-2">
            {spec.components.map((contract) => (
              <Card className="shadow-none" key={contract.name}>
                <CardHeader className="border-b">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{contract.name}</CardTitle>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{contract.intent}</p>
                    </div>
                    <EvidenceBadge confidence={contract.confidence} source={contract.source} />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-semibold">Props</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{contract.props.join(" · ")}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Variants / States</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{contract.variants.join(" · ")} / {contract.states.join(" · ")}</p>
                  </div>
                  <div>
                    <p className="font-semibold">关联 Token</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{contract.tokens.join(" · ")}</p>
                  </div>
                  <div>
                    <p className="font-semibold">适用边界</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{contract.useWhen}</p>
                  </div>
                  <div>
                    <p className="font-semibold">避免使用</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{contract.avoidWhen}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-3 sm:col-span-2">
                    <p className="font-semibold">示例</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{contract.example}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 sm:col-span-2">
                    <p className="font-semibold">校验规则</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{contract.validation}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-7 grid gap-2 xl:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4" /> 动效与响应式</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs leading-5 text-muted-foreground">
              {[...spec.motion, ...spec.responsiveNotes].map((item) => <p className="flex gap-2" key={item}><CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />{item}</p>)}
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader><CardTitle className="flex items-center gap-2"><CircleAlert className="size-4" /> 无障碍风险</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs leading-5 text-muted-foreground">
              {spec.accessibility.map((item) => <p className="flex gap-2" key={item}><CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />{item}</p>)}
            </CardContent>
          </Card>
        </section>

        <p className="mt-7 text-xs leading-5 text-muted-foreground">
          自动提取结果会受动态内容与浏览器策略影响。DesignFeed 明确区分页面证据与 AI 推断，管理员审核后才公开展示。
          <Link className="ml-1 underline underline-offset-4" href={`/removal-request?site=${encodeURIComponent(site.url)}`}>权利人申请下架</Link>
        </p>
      </div>
      </ScrollArea>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-muted via-muted/95 to-transparent px-3 pb-3 pt-8 sm:px-5 sm:pb-5">
        <div className="pointer-events-auto mx-auto max-w-3xl">
          <RemixButton site={site} />
        </div>
      </div>
    </div>
  );
}
