import { describe, expect, it } from "vitest";

import { querySites } from "./site-query";
import type { Site } from "@/types/site";

const sites = [
  {
    id: "one",
    slug: "one",
    title: "Alpha Studio",
    summary: "A quiet portfolio",
    url: "https://alpha.example",
    category: "作品集",
    tags: ["编辑设计"],
    featured: false,
    publishedAt: "2026-08-05T10:00:00.000Z",
  },
  {
    id: "two",
    slug: "two",
    title: "Orbit AI",
    summary: "AI workflow platform",
    url: "https://orbit.example",
    category: "AI/对话",
    tags: ["SaaS"],
    featured: true,
    publishedAt: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "three",
    slug: "three",
    title: "Metric Grid",
    summary: "Analytics dashboard",
    url: "https://metric.example",
    category: "数据面板",
    tags: ["SaaS"],
    featured: false,
    publishedAt: "2026-08-04T10:00:00.000Z",
  },
] as Site[];

describe("querySites", () => {
  it("puts featured projects first, then sorts by publish time", () => {
    expect(querySites(sites, { limit: 12 }).items.map((site) => site.id)).toEqual([
      "two",
      "one",
      "three",
    ]);
  });

  it("filters by category and searches title, summary and tags", () => {
    expect(
      querySites(sites, { category: "数据面板", q: "SaaS", limit: 12 }).items.map(
        (site) => site.id,
      ),
    ).toEqual(["three"]);
  });

  it("returns a cursor for the next page without duplicates", () => {
    const firstPage = querySites(sites, { limit: 2 });
    const secondPage = querySites(sites, { limit: 2, cursor: firstPage.nextCursor });

    expect(firstPage.items.map((site) => site.id)).toEqual(["two", "one"]);
    expect(secondPage.items.map((site) => site.id)).toEqual(["three"]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("keeps search and cursor pagination deterministic across 1000 projects", () => {
    const largeCatalog = Array.from({ length: 1000 }, (_, index) => ({
      ...sites[index % sites.length],
      id: `large-${index}`,
      slug: `large-${index}`,
      title: index % 10 === 0 ? `Design system ${index}` : `Website ${index}`,
      publishedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    })) as Site[];

    const firstPage = querySites(largeCatalog, { q: "Design system", limit: 12 });
    const secondPage = querySites(largeCatalog, { q: "Design system", limit: 12, cursor: firstPage.nextCursor });

    expect(firstPage.items).toHaveLength(12);
    expect(secondPage.items).toHaveLength(12);
    expect(new Set([...firstPage.items, ...secondPage.items].map((site) => site.id)).size).toBe(24);
  });
});
