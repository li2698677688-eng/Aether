import { describe, expect, it } from "vitest";

import { remixArtifactSchema } from "@/lib/contracts";
import {
  compileRemixLauncherPrompt,
  isReviewableRemixLauncherPrompt,
} from "@/lib/remix-artifact";
import { createRemixArtifactFixture } from "@/test/fixtures/remix-artifact";

describe("RemixArtifact 2.0", () => {
  it("accepts a deterministic runnable artifact that passed every viewport and gate", () => {
    expect(remixArtifactSchema.safeParse(createRemixArtifactFixture()).success).toBe(true);
  });

  it("rejects a declared pass when any required viewport is below 90%", () => {
    const artifact = createRemixArtifactFixture();
    artifact.quality.viewports[2]!.visualSimilarity = 0.8999;

    expect(remixArtifactSchema.safeParse(artifact).success).toBe(false);
  });

  it("rejects hidden visual masking and captured source JavaScript", () => {
    const passingArtifact = createRemixArtifactFixture();
    const artifact = {
      ...passingArtifact,
      quality: { ...passingArtifact.quality, maskedPixelRatio: 0.02 },
      safety: { ...passingArtifact.safety, executableSourceScriptsIncluded: true },
    };

    expect(remixArtifactSchema.safeParse(artifact).success).toBe(false);
  });

  it("rejects artifact URLs that escape the site-scoped DesignFeed delivery routes", () => {
    const artifact = createRemixArtifactFixture();
    artifact.delivery.bundleUrl = "https://attacker.example/payload.tgz";

    expect(remixArtifactSchema.safeParse(artifact).success).toBe(false);
  });

  it("requires a persisted compiler-result screenshot for every mandatory viewport", () => {
    const artifact = createRemixArtifactFixture();
    const evidenceWithoutCloneScreenshots = Object.fromEntries(
      Object.entries(artifact.evidence).filter(([key]) => key !== "cloneScreenshots"),
    );
    const artifactWithoutCloneEvidence = {
      ...artifact,
      evidence: evidenceWithoutCloneScreenshots,
    };

    expect(remixArtifactSchema.safeParse(artifactWithoutCloneEvidence).success).toBe(false);
  });

  it("compiles a short launcher that points AI tools at the verified runnable bundle", () => {
    const artifact = remixArtifactSchema.parse(createRemixArtifactFixture());
    const prompt = compileRemixLauncherPrompt(artifact);

    expect(prompt).toContain("# DesignFeed Remix Launcher 2.0");
    expect(prompt).toContain(artifact.delivery.bundleUrl);
    expect(prompt).toContain(artifact.delivery.bundleSha256);
    expect(prompt).toContain("不要根据自然语言重新猜测页面");
    expect(prompt.length).toBeLessThan(8_000);
    expect(isReviewableRemixLauncherPrompt(prompt, { siteId: "site-supabase" })).toBe(true);
  });

  it("refuses to launch an artifact whose quality gate is not passed", () => {
    const passingArtifact = createRemixArtifactFixture();
    const artifact = {
      ...passingArtifact,
      quality: {
        ...passingArtifact.quality,
        status: "failed" as const,
        worstVisualSimilarity: 0.72,
        viewports: passingArtifact.quality.viewports.map((viewport, index) => (
          index === 0 ? { ...viewport, visualSimilarity: 0.72 } : viewport
        )),
      },
    };
    const parsed = remixArtifactSchema.parse(artifact);

    expect(() => compileRemixLauncherPrompt(parsed)).toThrow("90%");
  });
});
