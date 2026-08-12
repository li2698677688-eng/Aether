import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SiteDetailShell } from "@/components/site-detail/site-detail-shell";
import { featuredSites } from "@/data/sites";

vi.mock("@/hooks/use-favorites", () => ({
  useFavorites: () => ({ favorites: new Set<string>(), toggleFavorite: vi.fn() }),
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: (props: React.HTMLAttributes<HTMLDivElement>) => <div role="separator" tabIndex={0} {...props} />,
}));

describe("SiteDetailShell accessibility", () => {
  it("describes the keyboard-adjustable preview divider", () => {
    render(<SiteDetailShell site={featuredSites[0]} />);

    const divider = screen.getByRole("separator", { name: "调整网站预览与设计规范宽度" });
    expect(divider).toHaveAttribute("tabindex", "0");
    expect(divider).toHaveAttribute("aria-valuemin", "45");
    expect(divider).toHaveAttribute("aria-valuemax", "80");
    expect(divider).toHaveAttribute("aria-valuenow", "62");
  });
});
