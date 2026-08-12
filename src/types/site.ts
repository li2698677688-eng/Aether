export const siteCategories = [
  "个人/品牌",
  "SaaS",
  "作品集",
  "落地页",
  "AI/对话",
  "移动产品",
  "数据面板",
  "电商",
  "实验性网页",
] as const;

export type SiteCategory = (typeof siteCategories)[number];

export type SiteStatus =
  | "queued"
  | "capturing"
  | "analyzing"
  | "in_review"
  | "published"
  | "rejected"
  | "failed";

export type EmbedStatus = "embeddable" | "screenshot_only" | "unknown";

export interface EvidenceMeta {
  source: "extracted" | "inferred";
  confidence: number;
}

export interface DesignToken extends EvidenceMeta {
  name: string;
  value: string;
  usage: string;
}

export interface ComponentContract extends EvidenceMeta {
  name: string;
  intent: string;
  props: string[];
  variants: string[];
  states: string[];
  tokens: string[];
  useWhen: string;
  avoidWhen: string;
  example: string;
  validation: string;
}

export interface DesignSpec {
  version: "1.0";
  generatedAt: string;
  overview: {
    description: string;
    mood: string[];
    useCases: string[];
  };
  typography: DesignToken[];
  colors: DesignToken[];
  layout: DesignToken[];
  spacing: DesignToken[];
  radius: DesignToken[];
  shadows: DesignToken[];
  components: ComponentContract[];
  motion: string[];
  accessibility: string[];
  responsiveNotes: string[];
}

export interface RemixArtifactFileReference {
  url: string;
  sha256: string;
  bytes?: number;
}

export interface RemixArtifact {
  version: "2.0";
  artifactId: string;
  generatedAt: string;
  compiler: {
    name: "designfeed-render-compiler";
    version: string;
    sourceRevision: string;
    deterministic: true;
  };
  reference: {
    siteId: string;
    title: string;
    originalUrl: string;
    capturedAt: string;
  };
  evidence: {
    renderIr: Required<RemixArtifactFileReference>;
    sourceScreenshots: Array<{
      width: number;
      height: number;
      url: string;
      sha256: string;
    }>;
    cloneScreenshots: Array<{
      width: number;
      height: number;
      url: string;
      sha256: string;
    }>;
  };
  delivery: {
    format: "tgz";
    framework: "next" | "vite";
    bundleUrl: string;
    bundleSha256: string;
    bundleBytes: number;
    manifestUrl: string;
    previewUrl: string;
  };
  quality: {
    status: "pending" | "passed" | "failed";
    minimumVisualSimilarity: number;
    worstVisualSimilarity: number;
    maskedPixelRatio: number;
    viewports: Array<{
      width: number;
      visualSimilarity: number;
      layoutMedianDeltaPx: number;
    }>;
    gates: {
      assets: boolean;
      build: boolean;
      capture: boolean;
      determinism: boolean;
      dom: boolean;
      interactions: boolean;
      layout: boolean;
      motion: boolean;
      pollution: boolean;
      responsive: boolean;
      style: boolean;
    };
  };
  safety: {
    publicSurfaceOnly: true;
    executableSourceScriptsIncluded: false;
    credentialFlowsBlocked: true;
    assetPolicy: "reference-only" | "rights-confirmed";
    untrustedContentBoundary: "BEGIN_UNTRUSTED_REFERENCE_DATA";
  };
}

export interface Site {
  id: string;
  slug: string;
  title: string;
  summary: string;
  url: string;
  category: SiteCategory;
  tags: string[];
  featured: boolean;
  publishedAt: string;
  capturedAt?: string;
  cover?: string;
  mobileCover?: string;
  accent?: string;
  author?: string;
  embedStatus?: EmbedStatus;
  status?: SiteStatus;
  designSpec?: DesignSpec;
  remixArtifact?: RemixArtifact;
}
