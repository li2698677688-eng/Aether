"use client";

import { ArrowUpRight, Bookmark } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SiteCoverPlaceholder } from "@/components/site-cover-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Site } from "@/types/site";

const COVER_BLUR_DATA_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 25 18'%3E%3Cfilter id='b'%3E%3CfeGaussianBlur stdDeviation='3'/%3E%3C/filter%3E%3Crect width='25' height='18' fill='%23d4d4d4' filter='url(%23b)'/%3E%3C/svg%3E";

interface SiteCardProps {
  site: Site;
  priority?: boolean;
  isFavorite: boolean;
  onFavorite: (siteId: string) => void;
}

export function SiteCard({ site, priority = false, isFavorite, onFavorite }: SiteCardProps) {
  return (
    <Card className="feed-card-visibility group relative aspect-[25/18] overflow-hidden rounded-[7px] border bg-muted p-0 shadow-none">
      <Link
        aria-label={`查看 ${site.title} 的网站预览和设计规范`}
        className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-inset"
        href={`/sites/${site.slug}`}
      >
        <span className="sr-only">查看 {site.title}</span>
      </Link>
      {site.cover ? (
        <Image
          alt={`${site.title} 网站首页封面`}
          blurDataURL={COVER_BLUR_DATA_URL}
          className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.012]"
          fill
          fetchPriority={priority ? "high" : undefined}
          priority={priority}
          placeholder="blur"
          quality={82}
          sizes="(max-width: 767px) 100vw, (max-width: 1100px) calc(100vw - 240px), 50vw"
          src={site.cover}
        />
      ) : (
        <SiteCoverPlaceholder site={site} />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex translate-y-2 items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-4 pb-4 pt-16 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="min-w-0 text-white">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">{site.title}</p>
          <p className="mt-0.5 truncate text-xs text-white/70">{site.summary}</p>
        </div>
        <Badge className="shrink-0 border-white/20 bg-black/35 text-white backdrop-blur-md" variant="outline">
          {site.category}
        </Badge>
      </div>
      <div className="absolute right-3 top-3 z-30 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          aria-label={isFavorite ? `取消收藏 ${site.title}` : `收藏 ${site.title}`}
          className="relative z-20 rounded-full border-white/20 bg-black/45 text-white shadow-sm backdrop-blur-md hover:bg-black/65 hover:text-white"
          onClick={(event) => {
            event.preventDefault();
            onFavorite(site.id);
          }}
          size="icon-sm"
          variant="outline"
        >
          <Bookmark aria-hidden="true" className={cn(isFavorite && "fill-current")} />
        </Button>
        <span className="flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-sm backdrop-blur-md">
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </span>
      </div>
    </Card>
  );
}
