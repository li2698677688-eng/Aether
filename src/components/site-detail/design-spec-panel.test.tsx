import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DesignSpecPanel } from "@/components/site-detail/design-spec-panel";
import { featuredSites } from "@/data/sites";

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("DesignSpecPanel contract coverage", () => {
  it("shows use cases, props, and examples from the reviewed DesignSpec", () => {
    const site = featuredSites[0];
    const useCase = site.designSpec!.overview.useCases[1];
    const example = site.designSpec!.components[0].example;
    const componentProps = site.designSpec!.components[0].props.join(" · ");

    render(<DesignSpecPanel site={site} />);

    expect(screen.getByRole("heading", { name: "适用场景" })).toBeInTheDocument();
    expect(screen.getByText(useCase)).toBeInTheDocument();
    expect(screen.getAllByText("示例")).toHaveLength(site.designSpec!.components.length);
    expect(screen.getByText(example)).toBeInTheDocument();
    expect(screen.getAllByText("Props")).toHaveLength(site.designSpec!.components.length);
    expect(screen.getByText(componentProps)).toBeInTheDocument();
  });
});
