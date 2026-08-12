"use client";

import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

import { AppLogo } from "@/components/app-logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { siteCategories, type SiteCategory } from "@/types/site";

interface FeedSidebarProps {
  compact?: boolean;
  collapsible?: boolean;
  query: string;
  selectedCategory: SiteCategory | "全部";
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: SiteCategory | "全部") => void;
  onCompactChange?: () => void;
}

export function FeedSidebar({
  compact = false,
  collapsible = false,
  query,
  selectedCategory,
  onQueryChange,
  onCategoryChange,
  onCompactChange,
}: FeedSidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className={cn("flex h-16 shrink-0 items-center", compact ? "justify-center px-2" : "justify-between px-4")}>
        <AppLogo compact={compact} />
        {collapsible && !compact && (
          <Button aria-label="折叠侧边栏" onClick={onCompactChange} size="icon-sm" variant="ghost">
            <ChevronLeft aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto pb-4", compact ? "px-2" : "px-3")}>
        {!compact ? (
          <label className="relative mb-4 block">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="搜索收录网站"
              className="h-9 bg-muted/55 pl-8 shadow-none"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索网站"
              type="search"
              value={query}
            />
          </label>
        ) : (
          <Button aria-label="展开后搜索" className="mb-4 w-full" onClick={onCompactChange} size="icon" variant="ghost">
            <Search aria-hidden="true" />
          </Button>
        )}

        {!compact && (
          <>
            <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <SlidersHorizontal aria-hidden="true" className="size-3" />
              分类
            </div>
            <nav aria-label="网站分类" className="space-y-0.5">
              <Button
                aria-pressed={selectedCategory === "全部"}
                className="w-full justify-between px-2.5"
                onClick={() => onCategoryChange("全部")}
                variant={selectedCategory === "全部" ? "default" : "ghost"}
              >
                <span>全部分类</span>
              </Button>
              {siteCategories.map((category) => (
                <Button
                  aria-pressed={selectedCategory === category}
                  className="w-full justify-between px-2.5"
                  key={category}
                  onClick={() => onCategoryChange(category)}
                  variant={selectedCategory === category ? "default" : "ghost"}
                >
                  <span>{category}</span>
                </Button>
              ))}
            </nav>
          </>
        )}
      </div>

      <div className={cn("shrink-0 border-t py-3", compact ? "px-2" : "px-3")}>
        {compact ? (
          <>
            <Link
              aria-label="投稿网站"
              className={cn(buttonVariants({ size: "icon", variant: "default" }), "mb-1 w-full")}
              href="/submit"
            >
              <Plus aria-hidden="true" />
            </Link>
            <div className="flex justify-center"><ModeToggle /></div>
            {collapsible && (
              <Button aria-label="展开侧边栏" className="mt-1 w-full" onClick={onCompactChange} size="icon" variant="ghost">
                <ChevronRight aria-hidden="true" />
              </Button>
            )}
          </>
        ) : (
          <>
            <Link className={cn(buttonVariants({ variant: "default" }), "mb-2 w-full")} href="/submit">
              <Plus aria-hidden="true" />
              投稿网站
            </Link>
            <div className="flex items-center justify-between pl-2 text-xs text-muted-foreground">
              <span>默认白天模式</span>
              <ModeToggle />
            </div>
            <nav aria-label="规则与下架" className="mt-2 flex flex-wrap gap-x-2 px-2 text-[11px] text-muted-foreground">
              <Link className="hover:text-foreground" href="/policies/privacy">隐私</Link>
              <Link className="hover:text-foreground" href="/policies/submissions">投稿规则</Link>
              <Link className="hover:text-foreground" href="/removal-request">申请下架</Link>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
