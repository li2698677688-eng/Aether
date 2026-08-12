import { describe, expect, it } from "vitest";

import { featuredSites, getSiteBySlug } from "./sites";

describe("featuredSites", () => {
  it("ships twenty unique, published seed projects", () => {
    expect(featuredSites).toHaveLength(20);
    expect(new Set(featuredSites.map((site) => site.slug)).size).toBe(20);
    expect(featuredSites.every((site) => site.status === "published")).toBe(true);
  });

  it("uses redistributable placeholder-ready seeds and provides a versioned design specification", () => {
    expect(featuredSites.every((site) => site.cover === undefined)).toBe(true);
    expect(featuredSites.every((site) => site.designSpec?.version === "1.0")).toBe(true);
  });

  it("resolves a project by slug", () => {
    expect(getSiteBySlug("vercel")?.title).toBe("Vercel");
    expect(getSiteBySlug("missing-site")).toBeUndefined();
  });
});
