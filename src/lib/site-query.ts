import type { Site, SiteCategory } from "@/types/site";

export interface SiteQuery {
  q?: string;
  category?: SiteCategory | "全部";
  sort?: "featured" | "latest";
  cursor?: string | null;
  limit?: number;
}

export interface SitePage {
  items: Site[];
  nextCursor: string | null;
}

function byPublishedAtDesc(a: Site, b: Site) {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
}

export function querySites(source: Site[], query: SiteQuery): SitePage {
  const normalizedQuery = query.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
  const limit = Math.min(Math.max(query.limit ?? 12, 1), 24);

  const filtered = source.filter((site) => {
    const categoryMatches =
      !query.category || query.category === "全部" || site.category === query.category;
    const searchText = [site.title, site.summary, site.category, ...site.tags]
      .join(" ")
      .toLocaleLowerCase("zh-CN");

    return categoryMatches && (!normalizedQuery || searchText.includes(normalizedQuery));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (query.sort !== "latest" && a.featured !== b.featured) {
      return a.featured ? -1 : 1;
    }
    return byPublishedAtDesc(a, b);
  });

  const cursorIndex = query.cursor
    ? sorted.findIndex((site) => site.id === query.cursor) + 1
    : 0;
  const start = Math.max(cursorIndex, 0);
  const items = sorted.slice(start, start + limit);
  const hasMore = start + items.length < sorted.length;

  return {
    items,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  };
}
