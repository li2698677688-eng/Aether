"use client";

import { Check, ExternalLink, RefreshCcw, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { DesignSpecReview } from "@/components/community/design-spec-review";
import { RemixArtifactReview } from "@/components/community/remix-artifact-review";
import { SiteCoverPlaceholder } from "@/components/site-cover-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { featuredSites } from "@/data/sites";
import type { ReviewItem } from "@/lib/community-repository";
import { siteCategories, type DesignSpec, type SiteCategory } from "@/types/site";

const demoItems: ReviewItem[] = featuredSites.slice(11, 14).map((site, index) => ({
  id: site.id,
  jobId: `demo-review-job-${index + 1}`,
  submittedBy: ["@lin", "@mia", "@bo"][index],
  category: site.category,
  attempts: index === 2 ? 2 : 1,
  durationMs: [48_000, 37_000, 71_000][index],
  errorCode: index === 2 ? "SCREENSHOT_UPLOAD_FAILED" : undefined,
  artifactReviewed: false,
  site: { ...site, status: index === 2 ? "failed" : "in_review" },
  demo: true,
}));

function formatDuration(value: number | undefined) {
  if (value === undefined) return "—";
  return value < 1000 ? `${value}ms` : `${Math.round(value / 1000)}s`;
}

export function AdminReviewBoard({ initialItems = demoItems }: { initialItems?: ReviewItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [rejectingId, setRejectingId] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  async function finish(item: ReviewItem, action: "通过" | "驳回" | "重试", reason?: string) {
    setPendingId(item.id);
    setError("");
    const actionPath = { 通过: "approve", 驳回: "reject", 重试: "retry" }[action];
    if (!item.demo) {
      const body = action === "通过"
        ? { category: item.category, ...(item.designSpecEdited ? { designSpec: item.site.designSpec } : {}), remixArtifactReviewed: true }
        : action === "驳回" ? { reason } : {};
      let response: Response;
      try {
        response = await fetch(`/api/admin/sites/${item.id}/${actionPath}`, {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
      } catch {
        setPendingId("");
        setError("网络连接失败，请检查连接后重试。");
        return;
      }
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setPendingId("");
        setError(result?.error || "审核操作失败，请稍后重试。");
        return;
      }
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setNotice(`${item.id} 已${action}`);
    setPendingId("");
    setRejectingId("");
    setRejectReason("");
  }

  function markArtifactReviewed(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, artifactReviewed: true } : item));
    setNotice(`${id} 的复刻证据已人工确认`);
  }

  function updateDesignSpec(id: string, designSpec: DesignSpec) {
    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      designSpecEdited: true,
      site: { ...item.site, designSpec },
    } : item));
    setNotice(`${id} 的 DesignSpec 修订已保存`);
  }

  function updateCategory(id: string, category: SiteCategory) {
    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      category,
    } : item));
    setNotice(`${id} 的分类已更新`);
  }

  const rejectingItem = items.find((item) => item.id === rejectingId);

  return (
    <>
      {notice && <div aria-live="polite" className="mb-4 rounded-lg border bg-background px-3 py-2 text-sm">{notice}</div>}
      {error && <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{error}</div>}
      <div className="space-y-4">
        {items.map((item, index) => {
          const site = item.site;
          const spec = site.designSpec;
          const reviewable = site.status === "in_review";
          return (
            <Card className="overflow-hidden py-0 shadow-none" key={item.id}>
              <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
                <div className="relative aspect-video min-h-64 border-b bg-muted lg:border-b-0 lg:border-r">
                  {site.cover
                    ? <Image alt={`${site.title} 后台项目截图`} className="object-cover object-top" fill priority={index === 0} sizes="(max-width: 1024px) 100vw, 65vw" src={site.cover} />
                    : <SiteCoverPlaceholder site={site} />}
                </div>
                <div className="flex min-w-0 flex-col">
                  <CardHeader className="border-b">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><CardTitle>{site.title}</CardTitle><p className="mt-1 truncate text-xs text-muted-foreground">{site.url}</p></div>
                      <Badge variant={reviewable ? "secondary" : "destructive"}>{reviewable ? "待审核" : "处理失败"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-5 py-4">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><p className="text-muted-foreground">投稿者</p><p className="mt-1 font-medium">{item.submittedBy}</p></div>
                      <div><p className="text-muted-foreground">采集耗时</p><p className="mt-1 font-medium">{formatDuration(item.durationMs)}</p></div>
                      <div><p className="text-muted-foreground">尝试次数</p><p className="mt-1 font-medium">{item.attempts}</p></div>
                    </div>
                    {item.errorCode && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                        <p className="font-medium text-destructive">失败代码</p>
                        <code className="mt-1 block break-all text-muted-foreground">{item.errorCode}</code>
                      </div>
                    )}
                    <div>
                      <label className="mb-2 block text-xs font-medium">公开分类</label>
                      <Select
                        onValueChange={(value) => updateCategory(item.id, value as SiteCategory)}
                        value={item.category}
                      >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{siteCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
                      <p className="flex items-center gap-1.5 font-medium text-foreground"><Sparkles className="size-3.5" /> {spec ? "设计规范已生成" : "设计规范缺失"}</p>
                      <p className="mt-1">{spec ? `${spec.typography.length} 个字体 Token · ${spec.colors.length} 个颜色 Token · ${spec.components.length} 个组件契约` : "请重新分析后再审核"}</p>
                      {site.remixArtifact ? (
                        <>
                          <p className="mt-2 font-medium text-foreground">
                            复刻产物已通过硬门槛 · 最差视口 {(site.remixArtifact.quality.worstVisualSimilarity * 100).toFixed(1)}%
                          </p>
                          <p className="mt-1">{item.artifactReviewed ? "复刻证据已人工确认" : "复刻证据待人工确认"}</p>
                        </>
                      ) : (
                        <p className="mt-2 font-medium text-destructive">复刻产物缺失，不能发布</p>
                      )}
                    </div>
                    {reviewable && spec && <DesignSpecReview edited={item.designSpecEdited} onReviewed={(designSpec) => updateDesignSpec(item.id, designSpec)} spec={spec} />}
                    {reviewable && site.remixArtifact && (
                      <RemixArtifactReview
                        artifact={site.remixArtifact}
                        onReviewed={() => markArtifactReviewed(item.id)}
                        reviewed={item.artifactReviewed}
                      />
                    )}
                    <a className="inline-flex items-center gap-1 text-xs font-medium hover:underline" href={site.url} rel="noreferrer" target="_blank">打开原站 <ExternalLink className="size-3" /></a>
                  </CardContent>
                  <div className={reviewable ? "grid grid-cols-3 gap-2 border-t p-3" : "border-t p-3"}>
                    {reviewable && <Button disabled={pendingId === item.id} onClick={() => { setRejectingId(item.id); setRejectReason(""); }} variant="destructive"><X aria-hidden="true" /> 驳回</Button>}
                    <Button className={reviewable ? undefined : "w-full"} disabled={pendingId === item.id} onClick={() => void finish(item, "重试")} variant="outline"><RefreshCcw aria-hidden="true" /> 重试</Button>
                    {reviewable && <Button disabled={!spec || !site.remixArtifact || !item.artifactReviewed || pendingId === item.id} onClick={() => void finish(item, "通过")}><Check aria-hidden="true" /> 通过</Button>}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {!items.length && <div className="rounded-xl border bg-background p-12 text-center"><Check className="mx-auto size-6" /><h2 className="mt-3 font-semibold">审核队列已清空</h2><p className="mt-1 text-sm text-muted-foreground">新的分析任务完成后会出现在这里。</p></div>}
      </div>

      <Dialog onOpenChange={(open) => { if (!open) setRejectingId(""); }} open={Boolean(rejectingItem)}>
        <DialogContent>
          <DialogHeader><DialogTitle>驳回 {rejectingItem?.site.title}</DialogTitle><DialogDescription>原因会写入审核日志，方便后续追踪。</DialogDescription></DialogHeader>
          <Textarea aria-label="驳回原因" maxLength={500} onChange={(event) => setRejectReason(event.target.value)} placeholder="请说明内容、截图或设计规范存在的问题" value={rejectReason} />
          <DialogFooter>
            <Button onClick={() => setRejectingId("")} variant="outline">取消</Button>
            <Button disabled={rejectReason.trim().length < 3 || pendingId === rejectingItem?.id} onClick={() => rejectingItem && void finish(rejectingItem, "驳回", rejectReason.trim())} variant="destructive">确认驳回</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
