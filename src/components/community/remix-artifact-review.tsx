"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RemixArtifact } from "@/types/site";

const gateLabels: Record<keyof RemixArtifact["quality"]["gates"], string> = {
  assets: "资源/字体",
  build: "构建",
  capture: "采集",
  determinism: "确定性",
  dom: "DOM",
  interactions: "交互",
  layout: "布局",
  motion: "动效",
  pollution: "页面污染",
  responsive: "响应式",
  style: "样式",
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function RemixArtifactReview({
  artifact,
  onReviewed,
  reviewed,
}: {
  artifact: RemixArtifact;
  onReviewed: () => void;
  reviewed: boolean;
}) {
  const [open, setOpen] = useState(false);

  function confirm() {
    onReviewed();
    setOpen(false);
  }

  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)} variant="outline">
        <ShieldCheck aria-hidden="true" />
        {reviewed ? "复刻证据已确认" : "检查复刻证据"}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>审核复刻证据</DialogTitle>
            <DialogDescription>
              不审核自然语言自评。请核对源截图、可运行预览、逐视口分数和每一道质量门，再决定是否公开。
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[62svh] space-y-5 overflow-y-auto pr-1 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">最差视口</p>
                <p className="mt-1 text-lg font-semibold">{percent(artifact.quality.worstVisualSimilarity)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">允许遮罩</p>
                <p className="mt-1 text-lg font-semibold">{percent(artifact.quality.maskedPixelRatio)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">代码包</p>
                <p className="mt-1 text-lg font-semibold">{(artifact.delivery.bundleBytes / 1_048_576).toFixed(1)} MB</p>
              </div>
            </div>

            <section>
              <h3 className="font-medium">逐视口视觉与布局</h3>
              <div className="mt-2 overflow-hidden rounded-lg border">
                {artifact.quality.viewports.map((viewport) => {
                  const sourceScreenshot = artifact.evidence.sourceScreenshots.find(({ width }) => width === viewport.width);
                  const cloneScreenshot = artifact.evidence.cloneScreenshots.find(({ width }) => width === viewport.width);
                  return (
                  <div className="grid grid-cols-[64px_1fr_1fr_auto_auto] items-center gap-2 border-b px-3 py-2 text-xs last:border-b-0" key={viewport.width}>
                    <span className="font-medium">{viewport.width}px</span>
                    <span>相似度 {percent(viewport.visualSimilarity)}</span>
                    <span>布局中位误差 {viewport.layoutMedianDeltaPx.toFixed(2)}px</span>
                    {sourceScreenshot && <a
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                      href={sourceScreenshot.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      源页面 <ExternalLink className="size-3" />
                    </a>}
                    {cloneScreenshot && <a
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                      href={cloneScreenshot.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      复刻结果 <ExternalLink className="size-3" />
                    </a>}
                  </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="font-medium">硬性质量门</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(artifact.quality.gates).map(([gate, passed]) => (
                  <Badge key={gate} variant={passed ? "secondary" : "destructive"}>
                    {gateLabels[gate as keyof typeof gateLabels]} · {passed ? "通过" : "失败"}
                  </Badge>
                ))}
              </div>
            </section>

            <section className="grid gap-2 sm:grid-cols-2">
              <a className="inline-flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted" href={artifact.delivery.previewUrl} rel="noreferrer" target="_blank">
                可运行预览 <ExternalLink className="size-4" />
              </a>
              <a className="inline-flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted" href={artifact.delivery.manifestUrl} rel="noreferrer" target="_blank">
                Artifact Manifest <ExternalLink className="size-4" />
              </a>
              <a className="inline-flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted" href={artifact.evidence.renderIr.url} rel="noreferrer" target="_blank">
                Render IR + 原始编译报告 <ExternalLink className="size-4" />
              </a>
              <a className="inline-flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted" href={artifact.delivery.bundleUrl} rel="noreferrer" target="_blank">
                下载代码包 <ExternalLink className="size-4" />
              </a>
            </section>

            <p className="rounded-lg border bg-muted p-3 text-xs leading-5 text-muted-foreground">
              SHA-256：<code className="break-all">{artifact.delivery.bundleSha256}</code>。确认只代表这些证据已人工检查，不代表登录、支付、私有数据或原站后端能力被复刻。
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setOpen(false)} variant="outline">取消</Button>
            <Button onClick={confirm}>确认已检查全部证据</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
