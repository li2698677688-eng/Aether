import { describe, expect, it } from "vitest";

import {
  decodeSiteCursor,
  encodeSiteCursor,
  mapPublishedSiteRow,
  publicSiteSelect,
  type PublishedSiteRow,
} from "@/lib/site-repository";
import { designSpecSchema } from "@/lib/contracts";
import { createRemixArtifactFixture } from "@/test/fixtures/remix-artifact";

const designSpec = designSpecSchema.parse({
  version: "1.0",
  generatedAt: "2026-08-05T08:00:00.000Z",
  overview: { description: "高密度产品后台", mood: ["克制"], useCases: ["SaaS"] },
  typography: [],
  colors: [],
  layout: [],
  spacing: [],
  radius: [],
  shadows: [],
  components: [],
  motion: [],
  accessibility: [],
  responsiveNotes: [],
});

const row: PublishedSiteRow = {
  id: "019fd13c-cb90-78b3-b99c-597458479aa3",
  slug: "example-console",
  title: "Example Console",
  summary: "一个可复刻的控制台参考。",
  url: "https://example.com/",
  featured: true,
  published_at: "2026-08-05T09:00:00.000Z",
  captured_at: "2026-08-05T08:00:00.000Z",
  screenshot_desktop: "https://project.supabase.co/storage/v1/object/public/site-screenshots/example/desktop.webp",
  screenshot_mobile: "https://project.supabase.co/storage/v1/object/public/site-screenshots/example/mobile.webp",
  embed_status: "embeddable",
  status: "published",
  design_spec: designSpec,
  remix_artifact: createRemixArtifactFixture(),
  categories: { name: "数据面板" },
  site_tags: [{ tags: { name: "后台" } }, { tags: { name: "分析" } }],
  profiles: { username: "lin", display_name: "Lin" },
};

describe("site repository contracts", () => {
  it("selects the submitting profile through the explicit foreign key", () => {
    expect(publicSiteSelect).toContain("profiles:profiles!sites_submitted_by_fkey(username,display_name)");
    expect(publicSiteSelect).not.toContain(",profiles(username,display_name)");
  });

  it("maps a published database row into the public Site contract", () => {
    expect(mapPublishedSiteRow(row)).toMatchObject({
      id: row.id,
      slug: "example-console",
      title: "Example Console",
      category: "数据面板",
      tags: ["后台", "分析"],
      cover: row.screenshot_desktop,
      mobileCover: row.screenshot_mobile,
      embedStatus: "embeddable",
      status: "published",
      author: "@lin",
      designSpec,
      remixArtifact: createRemixArtifactFixture(),
    });
  });

  it("uses safe public defaults when optional relations or generated fields are absent", () => {
    expect(mapPublishedSiteRow({
      ...row,
      summary: null,
      captured_at: null,
      screenshot_mobile: null,
      embed_status: "unknown",
      design_spec: { version: "malformed" },
      categories: null,
      site_tags: [],
      profiles: { username: null, display_name: "Mia" },
    })).toMatchObject({
      summary: "",
      category: "实验性网页",
      tags: [],
      mobileCover: undefined,
      embedStatus: "unknown",
      author: "Mia",
      designSpec: undefined,
    });
  });

  it("keeps private storage paths behind the reviewed screenshot endpoint", () => {
    expect(mapPublishedSiteRow({
      ...row,
      screenshot_desktop: `${row.id}/job-01/desktop.webp`,
      screenshot_mobile: `${row.id}/job-01/mobile.webp`,
    })).toMatchObject({
      cover: `/api/screenshots/${row.id}/desktop`,
      mobileCover: `/api/screenshots/${row.id}/mobile`,
    });
  });

  it("round-trips an opaque cursor and rejects malformed cursors", () => {
    const cursor = { featured: false, publishedAt: "2026-08-05T09:00:00.000Z", id: row.id };
    expect(decodeSiteCursor(encodeSiteCursor(cursor))).toEqual(cursor);
    expect(decodeSiteCursor("not-a-cursor")).toBeNull();
    expect(decodeSiteCursor(Buffer.from(JSON.stringify({ featured: "yes" })).toString("base64url"))).toBeNull();
  });
});
