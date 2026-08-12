"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";

import { SiteCard } from "@/components/feed/site-card";
import { buttonVariants } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import type { Site } from "@/types/site";

export function FavoriteGrid({ initialFavorites = [], sites }: { initialFavorites?: string[]; sites: Site[] }) {
  const { favorites, toggleFavorite } = useFavorites(initialFavorites);
  const saved = sites.filter((site) => favorites.has(site.id));

  if (!saved.length) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border bg-background p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Bookmark aria-hidden="true" className="size-5" /></span>
        <h2 className="mt-4 text-base font-semibold">还没有收藏</h2>
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">在首页悬停网站封面，点击收藏图标后会出现在这里。</p>
        <Link className={`${buttonVariants({ variant: "default" })} mt-4`} href="/">浏览网站</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {saved.map((site, index) => (
        <SiteCard isFavorite key={site.id} onFavorite={toggleFavorite} priority={index < 2} site={site} />
      ))}
    </div>
  );
}
