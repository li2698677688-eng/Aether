"use client";

import { ExternalLink, Globe2, ImageIcon, Monitor, Smartphone } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { SiteCoverPlaceholder } from "@/components/site-cover-placeholder";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Site } from "@/types/site";

type Device = "desktop" | "mobile";
const LIVE_LOAD_TIMEOUT_MS = 8_000;

export function SitePreview({ site }: { site: Site }) {
  const canEmbed = site.embedStatus === "embeddable";
  const [device, setDevice] = useState<Device>("desktop");
  const [showLiveSite, setShowLiveSite] = useState(false);
  const [liveSiteReady, setLiveSiteReady] = useState(false);
  const [liveSiteFailed, setLiveSiteFailed] = useState(false);
  const autoLoadAttempted = useRef(false);
  const cover = device === "mobile" ? site.mobileCover ?? site.cover : site.cover;

  useEffect(() => {
    if (!canEmbed || showLiveSite || autoLoadAttempted.current) return;
    const load = () => {
      autoLoadAttempted.current = true;
      setShowLiveSite(true);
    };
    if (window.requestIdleCallback) {
      const idleId = window.requestIdleCallback(load, { timeout: 1_200 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(load, 500);
    return () => window.clearTimeout(timer);
  }, [canEmbed, device, showLiveSite]);

  useEffect(() => {
    if (!canEmbed || !showLiveSite || liveSiteReady) return;
    const timeout = window.setTimeout(() => {
      setLiveSiteFailed(true);
      setShowLiveSite(false);
    }, LIVE_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [canEmbed, device, liveSiteReady, showLiveSite]);

  function switchDevice(nextDevice: Device) {
    autoLoadAttempted.current = false;
    setDevice(nextDevice);
    setShowLiveSite(false);
    setLiveSiteReady(false);
    setLiveSiteFailed(false);
  }

  function toggleLiveSite() {
    autoLoadAttempted.current = true;
    setLiveSiteFailed(false);
    setLiveSiteReady(false);
    setShowLiveSite((current) => !current);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/35">
      <div className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
          <Button
            aria-pressed={device === "desktop"}
            className={cn(device === "desktop" && "bg-background shadow-sm")}
            onClick={() => switchDevice("desktop")}
            size="icon-sm"
            variant="ghost"
          >
            <Monitor aria-hidden="true" />
            <span className="sr-only">桌面版预览</span>
          </Button>
          <Button
            aria-pressed={device === "mobile"}
            className={cn(device === "mobile" && "bg-background shadow-sm")}
            onClick={() => switchDevice("mobile")}
            size="icon-sm"
            variant="ghost"
          >
            <Smartphone aria-hidden="true" />
            <span className="sr-only">手机版预览</span>
          </Button>
        </div>
        <span className="hidden max-w-[55%] truncate text-xs text-muted-foreground sm:block">
          {new URL(site.url).hostname}
        </span>
        <a
          className={buttonVariants({ size: "sm", variant: "ghost" })}
          href={site.url}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" />
          原站
        </a>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
        <div
          className={cn(
            "relative mx-auto overflow-hidden rounded-[10px] border bg-white shadow-[0_18px_50px_rgba(0,0,0,.12)] transition-[width] duration-200",
            device === "desktop" ? "aspect-video w-full" : "aspect-[390/844] w-[min(390px,100%)]",
          )}
        >
          {cover ? (
            <Image
              alt={`${site.title} ${device === "desktop" ? "桌面版" : "手机版"}截图`}
              className="object-cover object-top"
              fill
              priority
              quality={75}
              sizes={device === "desktop" ? "80vw" : "390px"}
              src={cover}
            />
          ) : (
            <SiteCoverPlaceholder className="p-4 sm:p-8" site={site} />
          )}

          {showLiveSite && canEmbed && !liveSiteFailed && (
            <iframe
              aria-busy={!liveSiteReady}
              className={cn(
                "absolute inset-0 h-full w-full border-0 bg-white transition-opacity duration-200",
                liveSiteReady ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              key={device}
              onError={() => {
                setLiveSiteFailed(true);
                setLiveSiteReady(false);
                setShowLiveSite(false);
              }}
              onLoad={() => setLiveSiteReady(true)}
              referrerPolicy="no-referrer"
              sandbox="allow-forms allow-popups allow-scripts"
              src={site.url}
              title={`${site.title} 受限实时预览`}
            />
          )}

          {canEmbed && (
            <Button
              className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/92 shadow-md backdrop-blur"
              onClick={toggleLiveSite}
              size="sm"
              variant="outline"
            >
              {showLiveSite ? <ImageIcon aria-hidden="true" /> : <Globe2 aria-hidden="true" />}
              {showLiveSite ? "返回审核截图" : "加载实时页面"}
            </Button>
          )}
          <span aria-live="polite" className="sr-only">
            {showLiveSite && !liveSiteReady ? "正在加载真实网页" : liveSiteReady ? "真实网页已加载" : ""}
          </span>
        </div>
        {!canEmbed && (
          <Alert className="mx-auto mt-3 max-w-xl bg-background/75">
            <AlertDescription className="text-xs leading-5 text-muted-foreground">
              该网站限制嵌入，当前展示审核后的 CDN 截图；访问原站不会影响本页加载速度。
            </AlertDescription>
          </Alert>
        )}
        {liveSiteFailed && (
          <Alert className="mx-auto mt-3 max-w-xl bg-background/75">
            <AlertDescription className="text-xs leading-5 text-muted-foreground">
              实时页面未能载入，已自动回退到审核截图。你仍然可以通过“原站”在新窗口访问。
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
