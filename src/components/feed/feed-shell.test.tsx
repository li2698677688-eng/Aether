import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeedShell } from "@/components/feed/feed-shell";
import { featuredSites } from "@/data/sites";
import type { SitePage } from "@/lib/site-query";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/community/community-nav", () => ({
  CurrentCommunityNav: () => <div>账户导航</div>,
  MobileCommunityMenu: () => <button type="button">账户菜单</button>,
}));

vi.mock("@/components/feed/site-card", () => ({
  SiteCard: ({ site }: { site: { title: string } }) => <article>{site.title}</article>,
}));

vi.mock("@/components/feed/virtualized-site-grid", () => ({
  VirtualizedSiteGrid: ({ sites }: { sites: Array<{ title: string }> }) => <div>{sites.map((site) => <article key={site.title}>{site.title}</article>)}</div>,
}));

let intersectionCallback: IntersectionObserverCallback;

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  disconnect() {}
  observe() {}
  takeRecords() { return []; }
  unobserve() {}
}

const initialPage: SitePage = { items: [featuredSites[0]], nextCursor: "next-page" };

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("FeedShell remote pagination", () => {
  it("debounces a filter request, updates the URL, and replaces the feed without a document refresh", async () => {
    vi.useFakeTimers();
    const resultPage: SitePage = { items: [featuredSites[3]], nextCursor: null };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => resultPage });
    vi.stubGlobal("fetch", fetchMock);
    render(<FeedShell initialPage={initialPage} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索收录网站" }), { target: { value: "supabase" } });
    await act(async () => vi.advanceTimersByTimeAsync(251));

    expect(fetchMock).toHaveBeenCalledWith("/api/sites?q=supabase&limit=12", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(window.location.search).toBe("?q=supabase");
    expect(screen.getByText(featuredSites[3].title)).toBeInTheDocument();
    expect(screen.queryByText(featuredSites[0].title)).not.toBeInTheDocument();
  });

  it("loads the next cursor page when the sentinel enters the scroll viewport", async () => {
    const resultPage: SitePage = { items: [featuredSites[1]], nextCursor: null };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => resultPage });
    vi.stubGlobal("fetch", fetchMock);
    render(<FeedShell initialPage={initialPage} />);

    await act(async () => intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/sites?cursor=next-page&limit=12", expect.objectContaining({ signal: expect.any(AbortSignal) })));
    expect(screen.getByText(featuredSites[0].title)).toBeInTheDocument();
    expect(screen.getByText(featuredSites[1].title)).toBeInTheDocument();
  });
});
