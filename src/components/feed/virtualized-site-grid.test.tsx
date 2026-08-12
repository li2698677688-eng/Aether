import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VirtualizedSiteGrid } from "@/components/feed/virtualized-site-grid";
import { featuredSites } from "@/data/sites";
import type { Site } from "@/types/site";

const mocks = vi.hoisted(() => ({ count: 0 }));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => {
    mocks.count = count;
    return {
      getTotalSize: () => count * 360,
      getVirtualItems: () => [0, 1, 2].map((index) => ({ index, key: index, start: index * 360 })),
      measure: vi.fn(),
    };
  },
}));

vi.mock("@/components/feed/site-card", () => ({
  SiteCard: ({ site }: { site: Site }) => <article>{site.title}</article>,
}));

class TestResizeObserver {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe("VirtualizedSiteGrid", () => {
  it("keeps a 1000-project desktop feed to the visible rows", () => {
    const sites = Array.from({ length: 1000 }, (_, index) => ({
      ...featuredSites[index % featuredSites.length],
      id: `site-${index}`,
      slug: `site-${index}`,
      title: `Site ${index}`,
    }));
    const scrollElement = document.createElement("main");

    render(<VirtualizedSiteGrid favorites={new Set()} onFavorite={vi.fn()} scrollRef={{ current: scrollElement }} sites={sites} />);

    expect(mocks.count).toBe(500);
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getByText("Site 0")).toBeInTheDocument();
    expect(screen.queryByText("Site 999")).not.toBeInTheDocument();
  });
});
