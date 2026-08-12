export type EmbedStatus = "embeddable" | "screenshot_only";
const MAX_FULL_PAGE_HEIGHT = 12_000;
const MAX_MAIN_DOCUMENT_BYTES = 5_000_000;

function isPrivateIpv4(value: string) {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19));
}

export function isPrivateNetworkAddress(value: string) {
  const normalized = value.replace(/^\[|\]$/g, "").toLowerCase();
  return isPrivateIpv4(normalized)
    || normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("::ffff:")
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb")
    || normalized.startsWith("2001:db8:");
}

function isPlaceholderHostname(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "example.com"
    || normalized === "example.net"
    || normalized === "example.org"
    || normalized.endsWith(".example")
    || normalized.endsWith(".invalid")
    || normalized.endsWith(".test")
    || normalized === "localhost"
    || normalized.endsWith(".local")
    || normalized.endsWith(".internal")
    || normalized.endsWith(".localhost");
}

export function isValidAppBaseUrl(value: string | undefined) {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && !url.hash
      && !url.search
      && url.pathname === "/"
      && !isPrivateNetworkAddress(url.hostname)
      && !isPlaceholderHostname(url.hostname);
  } catch {
    return false;
  }
}

export function isStrongSharedSecret(value: string | undefined) {
  return Boolean(value?.trim() && value.trim().length >= 32);
}

export function appRequestHeaders(
  headers: Record<string, string>,
  deploymentBypassToken?: string,
) {
  if (!isStrongSharedSecret(deploymentBypassToken)) return headers;
  return { ...headers, "x-vercel-protection-bypass": deploymentBypassToken!.trim() };
}

export async function withAsyncResource<
  TResource extends { close(): Promise<void> },
  TResult,
>(
  create: () => Promise<TResource>,
  operate: (resource: TResource) => Promise<TResult>,
) {
  const resource = await create();
  try {
    return await operate(resource);
  } finally {
    await resource.close();
  }
}

export function authorizedRequestHeaders(
  target: URL,
  headers: Record<string, string>,
  authorizedOrigin?: { apiKey: string; origin: string },
) {
  if (!authorizedOrigin || target.origin !== authorizedOrigin.origin) return undefined;
  return { ...headers, authorization: `Bearer ${authorizedOrigin.apiKey}` };
}

export function clampFullPageHeight(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 900;
  return Math.min(Math.ceil(value), MAX_FULL_PAGE_HEIGHT);
}

export function detectEmbedStatus(headers: Record<string, string>, parentOrigin?: string): EmbedStatus {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value.toLowerCase()]));
  const frameOptions = normalized["x-frame-options"] ?? "";
  if (frameOptions.includes("deny") || frameOptions.includes("sameorigin")) return "screenshot_only";

  const csp = normalized["content-security-policy"] ?? "";
  const frameAncestors = csp.split(";").map((directive) => directive.trim()).find((directive) => directive.startsWith("frame-ancestors"));
  if (!frameAncestors) return "embeddable";
  const sources = frameAncestors.replace(/^frame-ancestors\s*/, "").split(/\s+/);
  const normalizedParentOrigin = parentOrigin?.replace(/\/$/, "").toLowerCase();
  const parentAllowed = sources.includes("*")
    || (normalizedParentOrigin ? sources.includes(normalizedParentOrigin) : false)
    || (normalizedParentOrigin?.startsWith("https://") ? sources.includes("https:") : false)
    || (normalizedParentOrigin?.startsWith("http://") ? sources.includes("http:") : false);
  return parentAllowed ? "embeddable" : "screenshot_only";
}

export function isMainDocumentWithinLimit(headers: Record<string, string>, transferredBytes = 0) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  const declaredSize = Number(normalized["content-length"] ?? 0);
  const declaredWithinLimit = !Number.isFinite(declaredSize) || declaredSize <= 0 || declaredSize <= MAX_MAIN_DOCUMENT_BYTES;
  const transferredWithinLimit = !Number.isFinite(transferredBytes) || transferredBytes <= 0 || transferredBytes <= MAX_MAIN_DOCUMENT_BYTES;
  return declaredWithinLimit && transferredWithinLimit;
}

function boundedText(value: unknown, limit: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, limit).trim();
}

export function normalizePageMetadata(input: { title?: unknown; description?: unknown }) {
  return {
    title: boundedText(input.title, 200),
    summary: boundedText(input.description, 500),
  };
}

export function assertCompleteRenderEvidence(value: unknown): asserts value is Record<string, unknown> & {
  nodeCount: number;
  nodes: unknown[];
  truncated: false;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("REMIX_EVIDENCE_INCOMPLETE");
  }
  const evidence = value as Record<string, unknown>;
  if (evidence.truncated === true) throw new Error("REMIX_EVIDENCE_TRUNCATED");
  if (evidence.truncated !== false
    || !Number.isInteger(evidence.nodeCount)
    || (evidence.nodeCount as number) < 0
    || !Array.isArray(evidence.nodes)
    || evidence.nodes.length !== evidence.nodeCount) {
    throw new Error("REMIX_EVIDENCE_INCOMPLETE");
  }
}

export function resolveAnalysisOutputs<TDesignSpec, TRemix>(
  designSpecResult: PromiseSettledResult<TDesignSpec>,
  remixResult: PromiseSettledResult<TRemix>,
) {
  if (remixResult.status === "rejected") throw remixResult.reason;
  return {
    designSpec: designSpecResult.status === "fulfilled" ? designSpecResult.value : undefined,
    remix: remixResult.value,
  };
}

export function encodeRemixEvidence(input: {
  capturedAt: string;
  compilerJobId: string;
  compilerVersion: string;
  compilerVerify: unknown;
  viewports: Array<Record<string, unknown>>;
}) {
  const serialized = JSON.stringify({
    version: "2.0",
    capturedAt: input.capturedAt,
    viewports: input.viewports,
    compiler: {
      jobId: input.compilerJobId,
      version: input.compilerVersion,
      verify: input.compilerVerify,
    },
  });
  if (!serialized) throw new Error("REMIX_EVIDENCE_INVALID");
  const bytes = new TextEncoder().encode(serialized);
  if (bytes.byteLength > 100_000_000) throw new Error("REMIX_EVIDENCE_TOO_LARGE");
  return bytes;
}

export function createNavigationRequestBudget(perNavigationLimit = 500, totalLimit = 3_000) {
  let navigationCount = 0;
  let totalCount = 0;
  return {
    startNavigation() {
      navigationCount = 0;
    },
    take() {
      if (navigationCount >= perNavigationLimit || totalCount >= totalLimit) return false;
      navigationCount += 1;
      totalCount += 1;
      return true;
    },
  };
}
