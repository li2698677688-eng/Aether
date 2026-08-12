const requiredGates = {
  assets: true,
  build: true,
  capture: true,
  determinism: true,
  dom: true,
  interactions: true,
  layout: true,
  motion: true,
  pollution: true,
  responsive: true,
  style: true,
} as const;

export function createRemixArtifactFixture() {
  return {
    version: "2.0" as const,
    artifactId: "remix_supabase_20260806",
    generatedAt: "2026-08-06T08:00:00.000Z",
    compiler: {
      name: "designfeed-render-compiler" as const,
      version: "2.0.0",
      sourceRevision: "0123456789abcdef0123456789abcdef01234567",
      deterministic: true as const,
    },
    reference: {
      siteId: "site-supabase",
      title: "Supabase",
      originalUrl: "https://supabase.com/",
      capturedAt: "2026-08-06T07:55:00.000Z",
    },
    evidence: {
      renderIr: {
        url: "https://designfeed.example/api/remix/site-supabase/evidence",
        sha256: "a".repeat(64),
        bytes: 245_120,
      },
      sourceScreenshots: [375, 768, 1280, 1920].map((width) => ({
        width,
        height: width === 375 ? 844 : 900,
        url: `https://designfeed.example/api/remix/site-supabase/source/${width}`,
        sha256: "b".repeat(64),
      })),
      cloneScreenshots: [375, 768, 1280, 1920].map((width) => ({
        width,
        height: width === 375 ? 844 : 900,
        url: `https://designfeed.example/api/remix/site-supabase/clone/${width}`,
        sha256: "d".repeat(64),
      })),
    },
    delivery: {
      format: "tgz" as const,
      framework: "next" as const,
      bundleUrl: "https://designfeed.example/api/remix/site-supabase/bundle",
      bundleSha256: "c".repeat(64),
      bundleBytes: 1_048_576,
      manifestUrl: "https://designfeed.example/api/remix/site-supabase/manifest",
      previewUrl: "https://designfeed.example/api/remix/site-supabase/preview/",
    },
    quality: {
      status: "passed" as const,
      minimumVisualSimilarity: 0.9,
      worstVisualSimilarity: 0.96,
      maskedPixelRatio: 0,
      viewports: [
        { width: 375, visualSimilarity: 0.96, layoutMedianDeltaPx: 0.86 },
        { width: 768, visualSimilarity: 0.9753, layoutMedianDeltaPx: 0.8 },
        { width: 1280, visualSimilarity: 0.9852, layoutMedianDeltaPx: 0.8 },
        { width: 1920, visualSimilarity: 0.9901, layoutMedianDeltaPx: 0.8 },
      ],
      gates: requiredGates,
    },
    safety: {
      publicSurfaceOnly: true as const,
      executableSourceScriptsIncluded: false as const,
      credentialFlowsBlocked: true as const,
      assetPolicy: "reference-only" as const,
      untrustedContentBoundary: "BEGIN_UNTRUSTED_REFERENCE_DATA" as const,
    },
  };
}
