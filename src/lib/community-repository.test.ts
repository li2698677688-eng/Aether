import { describe, expect, it } from "vitest";

import {
  getMySubmissions,
  mapReviewRow,
  mapSubmissionRow,
  reviewSiteSelect,
  statusPresentation,
  type ReviewDatabaseRow,
  type SubmissionDatabaseRow,
} from "@/lib/community-repository";
import { featuredSites } from "@/data/sites";
import { demoViewer } from "@/lib/auth";
import { createDemoJob } from "@/lib/demo-jobs";

const submissionRow: SubmissionDatabaseRow = {
  id: "job-01",
  status: "analyzing",
  attempts: 2,
  error_code: null,
  duration_ms: 1240,
  created_at: "2026-08-05T08:00:00.000Z",
  updated_at: "2026-08-05T08:02:00.000Z",
  sites: {
    id: "site-01",
    slug: "example",
    title: "Example",
    url: "https://example.com/",
    submitted_by: "user-01",
  },
};

describe("community repository mappings", () => {
  it("includes newly submitted local demo jobs in My Submissions", async () => {
    const url = `https://submitted-${crypto.randomUUID()}.example/`;
    const created = createDemoJob(url, "local-demo");

    const submissions = await getMySubmissions(demoViewer);

    expect(submissions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.id, title: new URL(url).hostname, url, status: "queued" }),
    ]));
  });

  it("does not require a category before a submitted site reaches moderation", () => {
    expect(reviewSiteSelect).toContain("categories(name)");
    expect(reviewSiteSelect).not.toContain("categories!inner(name)");
    expect(reviewSiteSelect).not.toContain("remix_prompt");
  });

  it("maps a private analysis job to a stable submission status item", () => {
    expect(mapSubmissionRow(submissionRow)).toEqual({
      id: "job-01",
      siteId: "site-01",
      slug: "example",
      title: "Example",
      url: "https://example.com/",
      status: "analyzing",
      attempts: 2,
      errorCode: undefined,
      durationMs: 1240,
      createdAt: submissionRow.created_at,
      updatedAt: submissionRow.updated_at,
    });
    expect(statusPresentation("analyzing")).toMatchObject({ label: "正在分析", progress: 62 });
    expect(statusPresentation("failed")).toMatchObject({ label: "处理失败", progress: 100 });
  });

  it("maps an in-review site and its latest job for the moderation board", () => {
    const source = featuredSites[0];
    const row: ReviewDatabaseRow = {
      id: source.id,
      slug: source.slug,
      title: source.title,
      summary: source.summary,
      url: source.url,
      featured: false,
      created_at: source.publishedAt,
      published_at: null,
      captured_at: source.capturedAt ?? null,
      screenshot_desktop: source.cover ?? null,
      screenshot_mobile: source.mobileCover ?? null,
      embed_status: "screenshot_only",
      status: "in_review",
      design_spec: source.designSpec,
      categories: { name: source.category },
      site_tags: [],
      profiles: { username: "lin", display_name: "Lin" },
      analysis_jobs: [{ id: "job-01", attempts: 2, duration_ms: 71000, error_code: null, updated_at: "2026-08-05T09:00:00.000Z" }],
    };

    expect(mapReviewRow(row)).toMatchObject({
      id: source.id,
      jobId: "job-01",
      submittedBy: "@lin",
      category: source.category,
      attempts: 2,
      durationMs: 71000,
      artifactReviewed: false,
      site: { id: source.id, status: "in_review" },
    });
  });

  it("keeps the latest failure details so an administrator can retry the task", () => {
    const source = featuredSites[0];
    const row: ReviewDatabaseRow = {
      id: source.id,
      slug: source.slug,
      title: source.title,
      summary: source.summary,
      url: source.url,
      featured: false,
      created_at: source.publishedAt,
      published_at: null,
      captured_at: source.capturedAt ?? null,
      screenshot_desktop: source.cover ?? null,
      screenshot_mobile: source.mobileCover ?? null,
      embed_status: "screenshot_only",
      status: "failed",
      design_spec: source.designSpec,
      categories: { name: source.category },
      site_tags: [],
      profiles: { username: "lin", display_name: "Lin" },
      analysis_jobs: [{
        id: "job-failed",
        attempts: 3,
        duration_ms: 84000,
        error_code: "SCREENSHOT_UPLOAD_FAILED",
        updated_at: "2026-08-05T10:00:00.000Z",
      }],
    };

    expect(mapReviewRow(row)).toMatchObject({
      jobId: "job-failed",
      attempts: 3,
      errorCode: "SCREENSHOT_UPLOAD_FAILED",
      site: { status: "failed" },
    });
  });
});
