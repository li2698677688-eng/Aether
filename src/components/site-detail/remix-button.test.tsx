import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RemixButton } from "@/components/site-detail/remix-button";
import { DesignSpecPanel } from "@/components/site-detail/design-spec-panel";
import { featuredSites } from "@/data/sites";
import { createRemixArtifactFixture } from "@/test/fixtures/remix-artifact";
import type { Site } from "@/types/site";

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
});

describe("RemixButton", () => {
  it("does not market a screenshot-derived legacy prompt as verified Remix", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<RemixButton site={featuredSites[1]} />);

    expect(screen.queryByRole("button", { name: "复刻" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复刻尚未验证" })).toBeDisabled();
    expect(screen.getByText("尚未通过多视口 90% 视觉验证，不能提供复刻")).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /登录/ })).not.toBeInTheDocument();
  });

  it("ignores an administrator-reviewed legacy prose prompt without a verified artifact", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const legacySite: Site & { remixPrompt: string } = {
      ...featuredSites[1],
      remixPrompt: "# DesignFeed Remix Prompt 1.0\n旧审核稿",
    };
    render(<RemixButton site={legacySite} />);

    expect(screen.getByRole("button", { name: "复刻尚未验证" })).toBeDisabled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("prioritizes the verified runnable artifact over the legacy prose prompt", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const artifact = createRemixArtifactFixture();
    const legacySite: Site & { remixPrompt: string } = {
      ...featuredSites[1],
      id: artifact.reference.siteId,
      remixArtifact: artifact,
      remixPrompt: "# DesignFeed Remix Prompt 1.0\n旧审核稿",
    };
    render(<RemixButton site={legacySite} />);

    await userEvent.click(screen.getByRole("button", { name: "复刻" }));

    expect(writeText.mock.calls[0][0]).toContain("# DesignFeed Remix Launcher 2.0");
    expect(writeText.mock.calls[0][0]).toContain(artifact.delivery.bundleUrl);
    expect(writeText.mock.calls[0][0]).not.toContain("# DesignFeed Remix Prompt 1.0");
    expect(screen.getByText("已验证 · 最差视口 96.0% · 4 个视口")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载代码包" })).toHaveAttribute("href", artifact.delivery.bundleUrl);
  });

  it("offers a selectable verified launcher when clipboard access fails", async () => {
    const artifact = createRemixArtifactFixture();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("clipboard blocked")) },
    });
    render(<RemixButton site={{ ...featuredSites[1], id: artifact.reference.siteId, remixArtifact: artifact }} />);

    await userEvent.click(screen.getByRole("button", { name: "复刻" }));

    expect(await screen.findByRole("heading", { name: "手动复制 Remix 提示词" })).toBeInTheDocument();
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Remix 提示词" }).value)
      .toContain("# DesignFeed Remix Launcher 2.0");
  });

  it("keeps an honest unavailable state inside the design specification panel", () => {
    render(<DesignSpecPanel site={featuredSites[1]} />);

    expect(screen.getByRole("button", { name: "复刻尚未验证" })).toBeDisabled();
    expect(screen.getByText("尚未通过多视口 90% 视觉验证，不能提供复刻")).toBeInTheDocument();
  });
});
