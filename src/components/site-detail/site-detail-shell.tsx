"use client";

import { ArrowLeft, Bookmark, Check, ExternalLink, Share2 } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { DesignSpecPanel } from "@/components/site-detail/design-spec-panel";
import { SitePreview } from "@/components/site-detail/site-preview";
import { Button, buttonVariants } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import type { Site } from "@/types/site";

type DetailMode = "spec" | "preview";
const LAYOUT_KEY = "designfeed:detail-preview-percent";

function readSavedLayout() {
  return window.localStorage.getItem(LAYOUT_KEY) ?? "62";
}

function subscribeToLayout(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function SiteDetailShell({ site }: { site: Site }) {
  const [mode, setMode] = useState<DetailMode>("spec");
  const [copied, setCopied] = useState(false);
  const storedLayout = useSyncExternalStore(subscribeToLayout, readSavedLayout, () => "62");
  const previewPercent = Math.min(Math.max(Number(storedLayout) || 62, 45), 80);
  const [currentPreviewPercent, setCurrentPreviewPercent] = useState(previewPercent);
  const { favorites, toggleFavorite } = useFavorites();
  const isFavorite = favorites.has(site.id);

  async function shareSite() {
    const shareData = { title: `${site.title} · DesignFeed`, url: window.location.href };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="h-svh overflow-hidden bg-background">
      <header className="flex h-14 items-center justify-between gap-2 border-b px-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Link
            aria-label="返回首页"
            className={cn(buttonVariants({ size: "icon", variant: "ghost" }), "shrink-0")}
            href="/"
          >
            <ArrowLeft aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[-0.02em]">{site.title}</p>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{site.category} · {site.author}</p>
          </div>
        </div>

        <div className="hidden items-center rounded-lg bg-muted p-0.5 sm:flex">
          <Button
            aria-pressed={mode === "spec"}
            className={cn(mode === "spec" && "bg-background shadow-sm")}
            onClick={() => setMode("spec")}
            size="sm"
            variant="ghost"
          >
            设计规范
          </Button>
          <Button
            aria-pressed={mode === "preview"}
            className={cn(mode === "preview" && "bg-background shadow-sm")}
            onClick={() => setMode("preview")}
            size="sm"
            variant="ghost"
          >
            仅预览
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            aria-label={isFavorite ? `取消收藏 ${site.title}` : `收藏 ${site.title}`}
            onClick={() => toggleFavorite(site.id)}
            size="icon"
            variant="ghost"
          >
            <Bookmark aria-hidden="true" className={cn(isFavorite && "fill-current")} />
          </Button>
          <Button aria-label="分享当前收录" onClick={shareSite} size="icon" variant="ghost">
            {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
          </Button>
          <ModeToggle />
          <a
            className={cn(buttonVariants({ variant: "default" }), "hidden md:inline-flex")}
            href={site.url}
            rel="noreferrer"
            target="_blank"
          >
            访问原站
            <ExternalLink aria-hidden="true" />
          </a>
        </div>
      </header>

      <main className="h-[calc(100svh-3.5rem)]">
        <h1 className="sr-only">{site.title} 网站预览与设计规范</h1>

        <div className="hidden h-full md:block">
          {mode === "preview" ? (
            <SitePreview site={site} />
          ) : (
            <ResizablePanelGroup
              className="h-full"
              defaultLayout={{ preview: previewPercent, spec: 100 - previewPercent }}
              id="site-detail-layout"
              key={`site-detail-layout-${previewPercent}`}
              onLayoutChanged={(layout, meta) => {
                setCurrentPreviewPercent(layout.preview);
                if (meta.isUserInteraction) {
                  window.localStorage.setItem(LAYOUT_KEY, String(layout.preview));
                }
              }}
              orientation="horizontal"
            >
              <ResizablePanel id="preview" maxSize="80%" minSize="45%">
                <SitePreview site={site} />
              </ResizablePanel>
              <ResizableHandle
                aria-label="调整网站预览与设计规范宽度"
                aria-valuemax={80}
                aria-valuemin={45}
                aria-valuenow={Math.round(currentPreviewPercent)}
                className="hover:bg-ring focus-visible:ring-2"
                withHandle
              />
              <ResizablePanel id="spec" minSize="20%">
                <DesignSpecPanel site={site} />
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>

        <Tabs className="h-full flex-col gap-0 md:hidden" onValueChange={(value) => setMode(value as DetailMode)} value={mode}>
          <TabsList className="mx-3 my-2 grid w-[calc(100%-1.5rem)] grid-cols-2" variant="default">
            <TabsTrigger value="spec">设计规范</TabsTrigger>
            <TabsTrigger value="preview">网站预览</TabsTrigger>
          </TabsList>
          <TabsContent className="min-h-0 overflow-hidden" value="spec"><DesignSpecPanel site={site} /></TabsContent>
          <TabsContent className="min-h-0 overflow-hidden" value="preview"><SitePreview site={site} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
