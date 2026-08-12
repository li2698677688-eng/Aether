import { describe, expect, it } from "vitest";

import { featuredSites } from "@/data/sites";
import { createRemixArtifactFixture } from "@/test/fixtures/remix-artifact";

import { adminReviewBodySchema, analysisCallbackSchema, canApplyAnalysisCallbackTransition, canIssueAnalysisUpload, canTransitionStatus, submissionSchema } from "./contracts";

describe("submission contract", () => {
  it("accepts an absolute http URL and rejects unsupported input", () => {
    expect(submissionSchema.safeParse({ url: "https://example.com" }).success).toBe(true);
    expect(submissionSchema.safeParse({ url: "file:///tmp/test" }).success).toBe(false);
    expect(submissionSchema.safeParse({ url: `https://example.com/${"a".repeat(2_100)}` }).success).toBe(false);
  });
});

describe("analysis callback contract", () => {
  it("only issues screenshot upload tickets during the capture stage", () => {
    expect(canIssueAnalysisUpload("capturing")).toBe(true);
    expect(canIssueAnalysisUpload("queued")).toBe(false);
    expect(canIssueAnalysisUpload("published")).toBe(false);
  });

  it("requires a known job stage", () => {
    expect(analysisCallbackSchema.safeParse({ jobId: "job-1", status: "analyzing" }).success).toBe(true);
    expect(analysisCallbackSchema.safeParse({ jobId: "job-1", status: "unknown" }).success).toBe(false);
  });

  it("accepts the complete capture result and rejects unknown embed states", () => {
    const result = {
      jobId: "job-1",
      status: "in_review",
      attempts: 2,
      title: "Example",
      summary: "Example summary",
      finalUrl: "https://example.com/home",
      embedStatus: "screenshot_only",
      screenshotDesktop: "site/job/desktop.webp",
      screenshotDesktopFull: "site/job/desktop-full.webp",
      screenshotMobile: "site/job/mobile.webp",
      screenshotMobileFull: "site/job/mobile-full.webp",
    };
    expect(analysisCallbackSchema.safeParse(result).success).toBe(true);
    expect(analysisCallbackSchema.safeParse({ ...result, embedStatus: "maybe" }).success).toBe(false);
  });

  it("accepts only a schema-valid RemixArtifact 2.0 and scoped storage paths", () => {
    const result = {
      jobId: "job-1",
      status: "in_review",
      remixArtifact: createRemixArtifactFixture(),
      remixBundlePath: "site-supabase/job-1/remix-bundle.tgz",
      remixEvidencePath: "site-supabase/job-1/render-ir.json",
      remixCompilerJobId: "job_compiler_1",
    };

    expect(analysisCallbackSchema.safeParse(result).success).toBe(true);
    expect(analysisCallbackSchema.safeParse({ ...result, remixBundlePath: "../secret.tgz" }).success).toBe(false);
    expect(analysisCallbackSchema.safeParse({
      ...result,
      remixArtifact: { ...result.remixArtifact, version: "1.0" },
    }).success).toBe(false);
  });

  it("only permits valid state transitions", () => {
    expect(canTransitionStatus("queued", "capturing")).toBe(true);
    expect(canTransitionStatus("analyzing", "capturing")).toBe(false);
    expect(canTransitionStatus("analyzing", "in_review")).toBe(true);
    expect(canTransitionStatus("published", "analyzing")).toBe(false);
    expect(canTransitionStatus("published", "rejected")).toBe(false);
    expect(canTransitionStatus("published", "queued")).toBe(false);
    expect(canTransitionStatus("capturing", "failed")).toBe(true);
  });

  it("only restarts capture from analysis for a strictly newer queue attempt", () => {
    expect(canApplyAnalysisCallbackTransition("analyzing", "capturing", 1, 2)).toBe(true);
    expect(canApplyAnalysisCallbackTransition("analyzing", "capturing", 2, 2)).toBe(false);
    expect(canApplyAnalysisCallbackTransition("analyzing", "capturing", 2, 1)).toBe(false);
    expect(canApplyAnalysisCallbackTransition("analyzing", "in_review", 2, 2)).toBe(true);
  });
});

describe("admin review contract", () => {
  it("accepts only an explicit verified-artifact acknowledgement and bounded reasons", () => {
    expect(adminReviewBodySchema.safeParse({ category: "SaaS", remixArtifactReviewed: true }).success).toBe(true);
    expect(adminReviewBodySchema.safeParse({ category: "SaaS", remixArtifactReviewed: false }).success).toBe(false);
    expect(adminReviewBodySchema.safeParse({ category: "SaaS", remixPrompt: "legacy prompt" }).success).toBe(false);
    expect(adminReviewBodySchema.safeParse({ category: "未知分类" }).success).toBe(false);
    expect(adminReviewBodySchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
  });

  it("accepts a complete corrected DesignSpec and rejects partial JSON", () => {
    expect(adminReviewBodySchema.safeParse({ category: "SaaS", designSpec: featuredSites[0].designSpec }).success).toBe(true);
    expect(adminReviewBodySchema.safeParse({ category: "SaaS", designSpec: { version: "broken" } }).success).toBe(false);
    expect(adminReviewBodySchema.safeParse({
      category: "SaaS",
      designSpec: {
        ...featuredSites[0].designSpec!,
        overview: { ...featuredSites[0].designSpec!.overview, description: "x".repeat(1_001) },
      },
    }).success).toBe(false);
    expect(adminReviewBodySchema.safeParse({
      category: "SaaS",
      designSpec: {
        ...featuredSites[0].designSpec!,
        components: [{ ...featuredSites[0].designSpec!.components[0], props: Array.from({ length: 33 }, (_, index) => `prop${index}: string`) }],
      },
    }).success).toBe(false);
  });
});
