"use client";

import { SiteCard } from "@/components/feed/site-card";
import { useFavorites } from "@/hooks/use-favorites";
import type { Site } from "@/types/site";

export function PublicSiteGrid({ sites }: { sites: Site[] }) {
  const { favorites, toggleFavorite } = useFavorites();
  return (
    <div className="mt-8 grid gap-3 md:grid-cols-2">
      {sites.map((site, index) => (
        <SiteCard isFavorite={favorites.has(site.id)} key={site.id} onFavorite={toggleFavorite} priority={index < 2} site={site} />
      ))}
    </div>
  );
}
