import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";

import { FeedSidebar } from "@/components/feed/feed-sidebar";
import type { SiteCategory } from "@/types/site";

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  }),
});

function renderSidebar({
  compact = false,
  selectedCategory = "全部",
}: {
  compact?: boolean;
  selectedCategory?: SiteCategory | "全部";
} = {}) {
  render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <FeedSidebar
        compact={compact}
        onCategoryChange={() => undefined}
        onQueryChange={() => undefined}
        query=""
        selectedCategory={selectedCategory}
      />
    </ThemeProvider>,
  );
}

describe("FeedSidebar", () => {
  it("keeps the expanded sidebar focused on search, categories, and submission", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "投稿网站" })).toHaveAttribute("href", "/submit");
    expect(screen.getByRole("button", { name: "全部分类" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "全部" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "最新" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "收藏" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "登录" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "审核后台" })).not.toBeInTheDocument();
  });

  it("does not move account navigation back into the compact sidebar", () => {
    renderSidebar({ compact: true });

    expect(screen.getByRole("link", { name: "投稿网站" })).toHaveAttribute("href", "/submit");
    expect(screen.queryByRole("link", { name: "登录" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "我的投稿" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "个人主页" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "审核后台" })).not.toBeInTheDocument();
  });

  it("keeps category options transparent until hover or selection", () => {
    renderSidebar({ selectedCategory: "SaaS" });
    const selectedCategory = screen.getByRole("button", { name: "SaaS" });
    expect(selectedCategory).toHaveAttribute("aria-pressed", "true");
    expect(selectedCategory).toHaveClass("bg-primary", "text-primary-foreground");

    const unselectedCategory = screen.getByRole("button", { name: "个人/品牌" });
    expect(unselectedCategory).toHaveAttribute("aria-pressed", "false");
    expect(unselectedCategory).toHaveClass("hover:bg-muted");
    expect(unselectedCategory).not.toHaveClass("bg-muted/45", "bg-primary");
  });
});
