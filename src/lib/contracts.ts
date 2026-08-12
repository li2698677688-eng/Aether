import { z } from "zod";

import type { SiteStatus } from "@/types/site";

const categorySchema = z.enum(["个人/品牌", "SaaS", "作品集", "落地页", "AI/对话", "移动产品", "数据面板", "电商", "实验性网页"]);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const httpUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "只支持 http/https 地址");

export const submissionSchema = z.object({
  url: z.string().trim().max(2_048).url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "只支持 http/https 网站地址"),
});

const statusSchema = z.enum(["queued", "capturing", "analyzing", "in_review", "published", "rejected", "failed"]);
const privateObjectPathSchema = z.string().min(3).max(512)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/)
  .refine((value) => value.split("/").every((segment) => segment && segment !== "." && segment !== ".."), "存储路径无效");

export const analysisCallbackSchema = z.object({
  jobId: z.string().min(1).max(128),
  status: statusSchema,
  attempts: z.number().int().min(0).max(3).optional(),
  title: z.string().max(200).optional(),
  summary: z.string().max(500).optional(),
  finalUrl: z.string().url().optional(),
  embedStatus: z.enum(["unknown", "embeddable", "screenshot_only"]).optional(),
  screenshotDesktop: z.string().min(1).max(512).optional(),
  screenshotDesktopFull: z.string().min(1).max(512).optional(),
  screenshotMobile: z.string().min(1).max(512).optional(),
  screenshotMobileFull: z.string().min(1).max(512).optional(),
  errorCode: z.string().max(120).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  extraction: z.record(z.string(), z.unknown()).optional(),
  designSpec: z.lazy(() => designSpecSchema).optional(),
  remixArtifact: z.lazy(() => remixArtifactSchema).optional(),
  remixBundlePath: privateObjectPathSchema.optional(),
  remixEvidencePath: privateObjectPathSchema.optional(),
  remixCompilerJobId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/).optional(),
}).strict();

const transitions: Record<SiteStatus, readonly SiteStatus[]> = {
  queued: ["capturing", "failed"],
  capturing: ["analyzing", "failed"],
  analyzing: ["in_review", "failed"],
  in_review: ["published", "rejected", "queued", "analyzing", "failed"],
  published: [],
  rejected: ["queued", "analyzing"],
  failed: ["queued", "capturing"],
};

export function canTransitionStatus(from: SiteStatus, to: SiteStatus) {
  return transitions[from].includes(to);
}

export function canApplyAnalysisCallbackTransition(
  from: SiteStatus,
  to: SiteStatus,
  currentAttempt: number,
  incomingAttempt: number | undefined,
) {
  if (incomingAttempt !== undefined && incomingAttempt < currentAttempt) return false;
  if (from === to) return true;
  if (from === "analyzing" && to === "capturing") {
    return incomingAttempt !== undefined && incomingAttempt > currentAttempt;
  }
  return canTransitionStatus(from, to);
}

export function canIssueAnalysisUpload(status: SiteStatus) {
  return status === "capturing";
}

const evidenceSchema = z.object({
  source: z.enum(["extracted", "inferred"]),
  confidence: z.number().min(0).max(1),
});

const designTokenSchema = evidenceSchema.extend({
  name: z.string().min(1).max(80),
  value: z.string().min(1).max(500),
  usage: z.string().min(1).max(500),
});

const boundedList = (items: number, characters = 200) => z.array(z.string().min(1).max(characters)).max(items);

export const designSpecSchema = z.object({
  version: z.literal("1.0"),
  generatedAt: z.string().datetime(),
  overview: z.object({
    description: z.string().min(1).max(1_000),
    mood: boundedList(12, 80),
    useCases: boundedList(12, 120),
  }),
  typography: z.array(designTokenSchema).max(32),
  colors: z.array(designTokenSchema).max(64),
  layout: z.array(designTokenSchema).max(32),
  spacing: z.array(designTokenSchema).max(32),
  radius: z.array(designTokenSchema).max(32),
  shadows: z.array(designTokenSchema).max(32),
  components: z.array(evidenceSchema.extend({
    name: z.string().min(1).max(80),
    intent: z.string().min(1).max(500),
    props: boundedList(32),
    variants: boundedList(20, 100),
    states: boundedList(20, 100),
    tokens: boundedList(32, 100),
    useWhen: z.string().min(1).max(1_000),
    avoidWhen: z.string().min(1).max(1_000),
    example: z.string().min(1).max(1_000),
    validation: z.string().min(1).max(1_000),
  })).max(40),
  motion: boundedList(32, 500),
  accessibility: boundedList(32, 500),
  responsiveNotes: boundedList(32, 500),
});

const artifactGatesSchema = z.object({
  assets: z.boolean(),
  build: z.boolean(),
  capture: z.boolean(),
  determinism: z.boolean(),
  dom: z.boolean(),
  interactions: z.boolean(),
  layout: z.boolean(),
  motion: z.boolean(),
  pollution: z.boolean(),
  responsive: z.boolean(),
  style: z.boolean(),
}).strict();

const requiredRemixViewports = [375, 768, 1280, 1920] as const;
const remixScreenshotSchema = z.object({
  width: z.number().int().min(320).max(3_840),
  height: z.number().int().min(320).max(20_000),
  url: httpUrlSchema,
  sha256: sha256Schema,
}).strict();

export const remixArtifactSchema = z.object({
  version: z.literal("2.0"),
  artifactId: z.string().min(8).max(160).regex(/^[a-zA-Z0-9_-]+$/),
  generatedAt: z.string().datetime(),
  compiler: z.object({
    name: z.literal("designfeed-render-compiler"),
    version: z.string().min(1).max(40),
    sourceRevision: z.string().regex(/^[a-f0-9]{40,64}$/i),
    deterministic: z.literal(true),
  }).strict(),
  reference: z.object({
    siteId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
    title: z.string().min(1).max(200),
    originalUrl: httpUrlSchema,
    capturedAt: z.string().datetime(),
  }).strict(),
  evidence: z.object({
    renderIr: z.object({
      url: httpUrlSchema,
      sha256: sha256Schema,
      bytes: z.number().int().positive().max(100_000_000),
    }).strict(),
    sourceScreenshots: z.array(remixScreenshotSchema).min(requiredRemixViewports.length).max(16),
    cloneScreenshots: z.array(remixScreenshotSchema).min(requiredRemixViewports.length).max(16),
  }).strict(),
  delivery: z.object({
    format: z.literal("tgz"),
    framework: z.enum(["next", "vite"]),
    bundleUrl: httpUrlSchema,
    bundleSha256: sha256Schema,
    bundleBytes: z.number().int().positive().max(500_000_000),
    manifestUrl: httpUrlSchema,
    previewUrl: httpUrlSchema,
  }).strict(),
  quality: z.object({
    status: z.enum(["pending", "passed", "failed"]),
    minimumVisualSimilarity: z.number().min(0.9).max(1),
    worstVisualSimilarity: z.number().min(0).max(1),
    maskedPixelRatio: z.number().min(0).max(0.01),
    viewports: z.array(z.object({
      width: z.number().int().min(320).max(3_840),
      visualSimilarity: z.number().min(0).max(1),
      layoutMedianDeltaPx: z.number().min(0).max(10_000),
    }).strict()).min(requiredRemixViewports.length).max(16),
    gates: artifactGatesSchema,
  }).strict(),
  safety: z.object({
    publicSurfaceOnly: z.literal(true),
    executableSourceScriptsIncluded: z.literal(false),
    credentialFlowsBlocked: z.literal(true),
    assetPolicy: z.enum(["reference-only", "rights-confirmed"]),
    untrustedContentBoundary: z.literal("BEGIN_UNTRUSTED_REFERENCE_DATA"),
  }).strict(),
}).strict().superRefine((artifact, context) => {
  const routeBase = `/api/remix/${encodeURIComponent(artifact.reference.siteId)}`;
  const scopedUrls = [
    { path: ["delivery", "bundleUrl"], url: artifact.delivery.bundleUrl, expectedPath: `${routeBase}/bundle` },
    { path: ["delivery", "manifestUrl"], url: artifact.delivery.manifestUrl, expectedPath: `${routeBase}/manifest` },
    { path: ["delivery", "previewUrl"], url: artifact.delivery.previewUrl, expectedPath: `${routeBase}/preview/` },
    { path: ["evidence", "renderIr", "url"], url: artifact.evidence.renderIr.url, expectedPath: `${routeBase}/evidence` },
    ...artifact.evidence.sourceScreenshots.map((screenshot, index) => ({
      path: ["evidence", "sourceScreenshots", index, "url"],
      url: screenshot.url,
      expectedPath: `${routeBase}/source/${screenshot.width}`,
    })),
    ...artifact.evidence.cloneScreenshots.map((screenshot, index) => ({
      path: ["evidence", "cloneScreenshots", index, "url"],
      url: screenshot.url,
      expectedPath: `${routeBase}/clone/${screenshot.width}`,
    })),
  ];
  const deliveryOrigins = new Set(scopedUrls.map(({ url }) => new URL(url).origin));
  if (deliveryOrigins.size !== 1) {
    context.addIssue({ code: "custom", message: "Remix 交付地址必须同源", path: ["delivery"] });
  }
  for (const item of scopedUrls) {
    const url = new URL(item.url);
    if (url.pathname !== item.expectedPath || url.search || url.hash || url.username || url.password) {
      context.addIssue({ code: "custom", message: "Remix 交付地址未绑定当前网站", path: item.path });
    }
  }

  const screenshotWidths = new Set(artifact.evidence.sourceScreenshots.map(({ width }) => width));
  const cloneScreenshotWidths = new Set(artifact.evidence.cloneScreenshots.map(({ width }) => width));
  const qualityWidths = new Set(artifact.quality.viewports.map(({ width }) => width));
  for (const width of requiredRemixViewports) {
    if (!screenshotWidths.has(width)) {
      context.addIssue({ code: "custom", message: `缺少 ${width}px 源截图`, path: ["evidence", "sourceScreenshots"] });
    }
    if (!qualityWidths.has(width)) {
      context.addIssue({ code: "custom", message: `缺少 ${width}px 质量结果`, path: ["quality", "viewports"] });
    }
    if (!cloneScreenshotWidths.has(width)) {
      context.addIssue({ code: "custom", message: `缺少 ${width}px 复刻结果截图`, path: ["evidence", "cloneScreenshots"] });
    }
  }
  if (screenshotWidths.size !== artifact.evidence.sourceScreenshots.length) {
    context.addIssue({ code: "custom", message: "源截图视口不能重复", path: ["evidence", "sourceScreenshots"] });
  }
  if (cloneScreenshotWidths.size !== artifact.evidence.cloneScreenshots.length) {
    context.addIssue({ code: "custom", message: "复刻结果截图视口不能重复", path: ["evidence", "cloneScreenshots"] });
  }
  if (qualityWidths.size !== artifact.quality.viewports.length) {
    context.addIssue({ code: "custom", message: "质量视口不能重复", path: ["quality", "viewports"] });
  }

  if (artifact.quality.status !== "passed") return;
  const worstMeasured = Math.min(...artifact.quality.viewports.map(({ visualSimilarity }) => visualSimilarity));
  if (artifact.quality.viewports.some(({ visualSimilarity }) => visualSimilarity < artifact.quality.minimumVisualSimilarity)) {
    context.addIssue({ code: "custom", message: "存在未达到视觉硬门槛的视口", path: ["quality", "viewports"] });
  }
  if (Math.abs(worstMeasured - artifact.quality.worstVisualSimilarity) > 0.000_1) {
    context.addIssue({ code: "custom", message: "最差视口分数与逐视口结果不一致", path: ["quality", "worstVisualSimilarity"] });
  }
  for (const [gate, passed] of Object.entries(artifact.quality.gates)) {
    if (!passed) context.addIssue({ code: "custom", message: `${gate} 门禁未通过`, path: ["quality", "gates", gate] });
  }
});

export const adminReviewBodySchema = z.object({
  category: categorySchema.optional(),
  designSpec: designSpecSchema.optional(),
  remixArtifactReviewed: z.literal(true).optional(),
  reason: z.string().trim().max(500).optional(),
}).strict();
