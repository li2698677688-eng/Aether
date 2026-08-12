import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SiteCard } from "@/components/feed/site-card";
import { featuredSites } from "@/data/sites";

describe("SiteCard image loading", () => {
  it("uses an owned text-and-color placeholder when no reviewed screenshot exists", () => {
    render(<SiteCard isFavorite={false} onFavorite={vi.fn()} priority site={featuredSites[0]} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByText(featuredSites[0].title)).not.toHaveLength(0);
    expect(screen.getAllByText(featuredSites[0].category)).not.toHaveLength(0);
  });

  it("gives a runtime-reviewed above-the-fold cover a high network priority", () => {
    const site = { ...featuredSites[0], cover: "/api/screenshots/site-01/desktop" };
    render(<SiteCard isFavorite={false} onFavorite={vi.fn()} priority site={site} />);

    expect(screen.getByRole("img", { name: `${site.title} 网站首页封面` })).toHaveAttribute("fetchpriority", "high");
  });

  it("keeps a blurred placeholder behind a runtime-reviewed cover while it loads", () => {
    const site = { ...featuredSites[0], cover: "/api/screenshots/site-01/desktop" };
    render(<SiteCard isFavorite={false} onFavorite={vi.fn()} site={site} />);

    expect(screen.getByRole("img", { name: `${site.title} 网站首页封面` }))
      .toHaveStyle({ backgroundSize: "cover" });
  });
});
