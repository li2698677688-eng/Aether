"use client";

import { Menu, SearchX } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { AppLogo } from "@/components/app-logo";
import { CurrentCommunityNav, MobileCommunityMenu } from "@/components/community/community-nav";
import { FeedSidebar } from "@/components/feed/feed-sidebar";
import { SiteCard } from "@/components/feed/site-card";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import type { SitePage } from "@/lib/site-query";
import { siteCategories, type SiteCategory } from "@/types/site";

const PAGE_SIZE = 12;
const VIRTUALIZE_AFTER = 36;
const VirtualizedSiteGrid = dynamic(
  () => import("@/components/feed/virtualized-site-grid").then((module) => module.VirtualizedSiteGrid),
  { ssr: false },
);
const LazySheet = dynamic(() => import("@/components/ui/lazy-sheet").then((module) => module.LazySheet), { ssr: false });

function readCategory(value: string | null): SiteCategory | "全部" {
  return siteCategories.includes(value as SiteCategory) ? (value as SiteCategory) : "全部";
}

function createSiteRequestUrl({
  category,
  cursor,
  query,
  sort,
}: {
  category: SiteCategory | "全部";
  cursor?: string | null;
  query: string;
  sort: "featured" | "latest";
}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (category !== "全部") params.set("category", category);
  if (sort === "latest") params.set("sort", sort);
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(PAGE_SIZE));
  return `/api/sites?${params.toString()}`;
}

async function readSitePage(response: Response): Promise<SitePage> {
  const body = await response.json().catch(() => null) as SitePage | { error?: string } | null;
  if (!response.ok) throw new Error(body && "error" in body ? body.error || "网站列表加载失败" : "网站列表加载失败");
  if (!body || !("items" in body) || !Array.isArray(body.items)) throw new Error("网站列表返回格式错误");
  return body;
}

export function FeedShell({ initialPage }: { initialPage: SitePage }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState<SiteCategory | "全部">(readCategory(searchParams.get("category")));
  const sort = searchParams.get("sort") === "latest" ? "latest" : "featured";
  const [compact, setCompact] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sites, setSites] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [pending, setPending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const scrollRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const initialFilterEffect = useRef(true);
  const filterController = useRef<AbortController | null>(null);
  const paginationController = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);
  const { favorites, toggleFavorite } = useFavorites();

  useEffect(() => {
    if (initialFilterEffect.current) {
      initialFilterEffect.current = false;
      return;
    }
    filterController.current?.abort();
    paginationController.current?.abort();
    loadingMoreRef.current = false;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (category !== "全部") params.set("category", category);
      if (sort === "latest") params.set("sort", sort);
      const next = params.toString();
      window.history.replaceState(null, "", next ? `${pathname}?${next}` : pathname);

      const controller = new AbortController();
      filterController.current = controller;
      setPending(true);
      setFeedError("");
      void fetch(createSiteRequestUrl({ category, query, sort }), { signal: controller.signal })
        .then(readSitePage)
        .then((page) => {
          setSites(page.items);
          setNextCursor(page.nextCursor);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setFeedError(error instanceof Error ? error.message : "网站列表加载失败");
        })
        .finally(() => {
          if (!controller.signal.aborted) setPending(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      filterController.current?.abort();
    };
  }, [category, pathname, query, retryVersion, sort]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current || pending) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setFeedError("");
    const controller = new AbortController();
    paginationController.current = controller;
    try {
      const response = await fetch(createSiteRequestUrl({ category, cursor: nextCursor, query, sort }), { signal: controller.signal });
      const page = await readSitePage(response);
      setSites((current) => {
        const knownIds = new Set(current.map((site) => site.id));
        return [...current, ...page.items.filter((site) => !knownIds.has(site.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (!controller.signal.aborted) setFeedError(error instanceof Error ? error.message : "更多网站加载失败");
    } finally {
      loadingMoreRef.current = false;
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }, [category, nextCursor, pending, query, sort]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { root: scrollRef.current, rootMargin: "500px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  function resetAndSetCategory(value: SiteCategory | "全部") {
    setNextCursor(null);
    setCategory(value);
  }

  const sidebarProps = {
    query,
    selectedCategory: category,
    onQueryChange: (value: string) => {
      setNextCursor(null);
      setQuery(value);
    },
    onCategoryChange: resetAndSetCategory,
  };

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--foreground)_3%,transparent),transparent_42%)]">
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden border-r bg-background transition-[width] duration-200 md:block"
        style={{ width: compact ? "4rem" : "var(--sidebar-width)" }}
      >
        <FeedSidebar
          {...sidebarProps}
          collapsible
          compact={compact}
          onCompactChange={() => setCompact((value) => !value)}
        />
      </aside>

      <header
        className="fixed right-0 top-0 z-30 hidden h-14 items-center justify-end border-b bg-background/90 px-3 backdrop-blur-xl transition-[left] duration-200 md:flex"
        style={{ left: compact ? "4rem" : "var(--sidebar-width)" }}
      >
        <CurrentCommunityNav />
      </header>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/90 px-3 backdrop-blur-xl md:hidden">
        <AppLogo />
        <div className="flex items-center gap-1">
          <MobileCommunityMenu />
          <ModeToggle />
          <Button aria-expanded={filterOpen} aria-label="打开筛选" onClick={() => setFilterOpen(true)} ref={filterTriggerRef} size="icon" variant="ghost">
            <Menu aria-hidden="true" />
          </Button>
          {filterOpen && <LazySheet
            className="w-[18rem] p-0"
            description="按关键词和分类筛选网站"
            onOpenChange={(open) => {
              setFilterOpen(open);
              if (!open) window.setTimeout(() => filterTriggerRef.current?.focus(), 0);
            }}
            open={filterOpen}
            side="left"
            title="筛选网站"
          >
              <FeedSidebar {...sidebarProps} />
          </LazySheet>}
        </div>
      </header>

      <main
        aria-busy={pending || loadingMore}
        className="h-[calc(100svh-3.5rem)] overflow-y-auto transition-[padding] duration-200 md:h-svh md:pl-[var(--sidebar-current)]"
        ref={scrollRef}
        style={{ "--sidebar-current": compact ? "4rem" : "var(--sidebar-width)" } as CSSProperties}
      >
        <div className="md:pt-14">
          <h1 className="sr-only">优秀网站灵感与设计规范</h1>
          {feedError && (
            <div className="m-2.5 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm" role="alert">
              <span>{feedError}</span>
              <Button onClick={() => setRetryVersion((version) => version + 1)} size="sm" variant="outline">重试</Button>
            </div>
          )}
          {sites.length ? (
            sites.length > VIRTUALIZE_AFTER ? (
              <VirtualizedSiteGrid
                favorites={favorites}
                onFavorite={toggleFavorite}
                scrollRef={scrollRef}
                sites={sites}
              />
            ) : (
              <div className="grid grid-cols-1 gap-[var(--feed-gap)] p-2 sm:p-2.5 lg:grid-cols-2">
                {sites.map((site, index) => (
                  <SiteCard
                    isFavorite={favorites.has(site.id)}
                    key={site.id}
                    onFavorite={toggleFavorite}
                    priority={index < 2}
                    site={site}
                  />
                ))}
              </div>
            )
          ) : !pending ? (
            <div className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center px-6 text-center">
              <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                <SearchX aria-hidden="true" className="size-5 text-muted-foreground" />
              </span>
              <h2 className="text-base font-semibold">没有找到匹配的网站</h2>
              <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
                尝试清空关键词，或切换到其他分类。
              </p>
              <Button
                className="mt-4"
                onClick={() => {
                  setQuery("");
                  resetAndSetCategory("全部");
                }}
                variant="outline"
              >
                清空筛选
              </Button>
            </div>
          ) : <div className="min-h-[calc(100svh-3.5rem)]" />}
          <div aria-hidden="true" className="h-px" ref={sentinelRef} />
          {loadingMore && <p className="pb-4 text-center text-xs text-muted-foreground">正在加载更多网站…</p>}
        </div>
      </main>
    </div>
  );
}
