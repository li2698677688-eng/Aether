"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { compileRemixLauncherPrompt } from "@/lib/remix-artifact";
import type { Site } from "@/types/site";

type CopyState = "idle" | "copied";

export function RemixButton({ site }: { site: Site }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [fallbackPrompt, setFallbackPrompt] = useState("");
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function copyPrompt() {
    if (!site.remixArtifact) return;
    let prompt = "";
    try {
      prompt = compileRemixLauncherPrompt(site.remixArtifact);
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setFallbackPrompt(prompt);
      setFallbackOpen(true);
    }
  }

  return (
    <>
      <div className="rounded-xl border bg-background/95 p-2 shadow-[0_-12px_32px_rgba(0,0,0,.08)] backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
          <p>
            {site.remixArtifact
              ? `已验证 · 最差视口 ${(site.remixArtifact.quality.worstVisualSimilarity * 100).toFixed(1)}% · ${site.remixArtifact.quality.viewports.length} 个视口`
              : "尚未通过多视口 90% 视觉验证，不能提供复刻"}
          </p>
          {site.remixArtifact && (
            <a className="shrink-0 underline underline-offset-4 hover:text-foreground focus-visible:text-foreground" href={site.remixArtifact.delivery.bundleUrl}>
              下载代码包
            </a>
          )}
        </div>
        <Button className="h-10 w-full" disabled={!site.remixArtifact} onClick={copyPrompt}>
          {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copyState === "copied" ? "已复制" : site.remixArtifact ? "复刻" : "复刻尚未验证"}
        </Button>
        <span aria-live="polite" className="sr-only">
          {copyState === "copied" ? "Remix 提示词已复制" : ""}
        </span>
      </div>

      <Dialog onOpenChange={setFallbackOpen} open={fallbackOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>手动复制 Remix 提示词</DialogTitle>
            <DialogDescription>
              浏览器没有授予剪贴板权限。点击下方文本后全选复制，再粘贴到你的 AI 工具。
            </DialogDescription>
          </DialogHeader>
          {fallbackPrompt ? (
            <Textarea
              aria-label="Remix 提示词"
              className="max-h-[55svh] min-h-72 resize-y font-mono text-xs leading-5"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={fallbackPrompt}
            />
          ) : (
            <p className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
              当前网站还没有通过多视口质量门，不能生成 Remix 启动器。
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
