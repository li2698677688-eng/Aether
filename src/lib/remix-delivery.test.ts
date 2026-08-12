import { describe, expect, it } from "vitest";

import { parseDeliverableRemixRow, parseReviewableRemixRow } from "@/lib/remix-delivery";
import { createRemixArtifactFixture } from "@/test/fixtures/remix-artifact";

function row() {
  const artifact = createRemixArtifactFixture();
  return {
    status: "published",
    remix_artifact: artifact,
    remix_bundle_path: `${artifact.reference.siteId}/job-1/remix-bundle.tgz`,
    remix_evidence_path: `${artifact.reference.siteId}/job-1/render-ir.json`,
    remix_compiler_job_id: "job_compiler_1",
  };
}

describe("public Remix artifact delivery", () => {
  it("accepts only a published, verified artifact whose private paths are site-scoped", () => {
    const deliverable = parseDeliverableRemixRow(row(), "site-supabase");

    expect(deliverable?.artifact.quality.worstVisualSimilarity).toBe(0.96);
    expect(deliverable?.bundlePath).toBe("site-supabase/job-1/remix-bundle.tgz");
  });

  it("fails closed on cross-site paths, traversal, mismatched manifests, or unpublished rows", () => {
    expect(parseDeliverableRemixRow({ ...row(), remix_bundle_path: "other/job/bundle.tgz" }, "site-supabase")).toBeNull();
    expect(parseDeliverableRemixRow({ ...row(), remix_evidence_path: "site-supabase/../secret.json" }, "site-supabase")).toBeNull();
    expect(parseDeliverableRemixRow({ ...row(), remix_evidence_path: "site-supabase/job/<script>.json" }, "site-supabase")).toBeNull();
    expect(parseDeliverableRemixRow(row(), "another-site")).toBeNull();
    expect(parseDeliverableRemixRow({ ...row(), status: "in_review" }, "site-supabase")).toBeNull();
  });

  it("lets moderation inspect a complete in-review artifact without making it public", () => {
    const reviewRow = { ...row(), status: "in_review" };

    expect(parseDeliverableRemixRow(reviewRow, "site-supabase")).toBeNull();
    expect(parseReviewableRemixRow(reviewRow, "site-supabase")).toEqual({
      artifact: reviewRow.remix_artifact,
      bundlePath: reviewRow.remix_bundle_path,
      compilerJobId: reviewRow.remix_compiler_job_id,
      evidencePath: reviewRow.remix_evidence_path,
    });
  });
});
