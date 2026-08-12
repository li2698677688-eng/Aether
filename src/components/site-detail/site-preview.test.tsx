import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SitePreview } from "@/components/site-detail/site-preview";
import { featuredSites } from "@/data/sites";

afterEach(() => vi.useRealTimers());

describe("SitePreview live website priority", () => {
  it("loads the real website by default while keeping the screenshot as a stable placeholder", () => {
    vi.useFakeTimers();
    const site = {
      ...featuredSites[1],
      cover: "/api/screenshots/site-02/desktop",
      mobileCover: "/api/screenshots/site-02/mobile",
      embedStatus: "embeddable" as const,
    };
    render(<SitePreview site={site} />);

    expect(screen.getByAltText("Supabase 桌面版截图")).toBeInTheDocument();
    expect(screen.queryByTitle("Supabase 受限实时预览")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(600));
    const frame = screen.getByTitle("Supabase 受限实时预览");
    expect(frame).toHaveAttribute("src", "https://supabase.com/");
    expect(frame).toHaveClass("opacity-0");

    fireEvent.load(frame);
    expect(frame).toHaveClass("opacity-100");
  });

  it("rebuilds the live website at the mobile viewport when the device changes", () => {
    vi.useFakeTimers();
    const site = {
      ...featuredSites[1],
      cover: "/api/screenshots/site-02/desktop",
      mobileCover: "/api/screenshots/site-02/mobile",
      embedStatus: "embeddable" as const,
    };
    render(<SitePreview site={site} />);
    act(() => vi.advanceTimersByTime(600));
    const desktopFrame = screen.getByTitle("Supabase 受限实时预览");

    fireEvent.click(screen.getByRole("button", { name: "手机版预览" }));
    act(() => vi.advanceTimersByTime(600));

    const mobileFrame = screen.getByTitle("Supabase 受限实时预览");
    expect(mobileFrame).not.toBe(desktopFrame);
    expect(mobileFrame).toHaveClass("opacity-0");
    expect(screen.getByAltText("Supabase 手机版截图")).toBeInTheDocument();
  });

  it("uses the reviewed screenshot when the source website blocks embedding", () => {
    render(<SitePreview site={{
      ...featuredSites[1],
      cover: "/api/screenshots/site-02/desktop",
      embedStatus: "screenshot_only",
    }} />);

    expect(screen.queryByTitle("Supabase 受限实时预览")).not.toBeInTheDocument();
    expect(screen.getByText(/该网站限制嵌入/)).toBeInTheDocument();
  });

  it("falls back to the reviewed screenshot when a live website does not load in time", () => {
    vi.useFakeTimers();
    const site = {
      ...featuredSites[1],
      cover: "/api/screenshots/site-02/desktop",
      embedStatus: "embeddable" as const,
    };
    render(<SitePreview site={site} />);

    act(() => vi.advanceTimersByTime(600));
    act(() => vi.advanceTimersByTime(8_001));

    expect(screen.queryByTitle("Supabase 受限实时预览")).not.toBeInTheDocument();
    expect(screen.getByText(/实时页面未能载入/)).toBeInTheDocument();
    expect(screen.getByAltText("Supabase 桌面版截图")).toBeInTheDocument();
  });

  it("uses an owned placeholder as the stable fallback when no reviewed screenshot exists", () => {
    render(<SitePreview site={{ ...featuredSites[1], embedStatus: "screenshot_only" }} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("数据面板")).toBeInTheDocument();
  });
});
