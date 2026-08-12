import type { RemixArtifact } from "../types/site";

export const requiredRemixViewports = [375, 768, 1280, 1920] as const;

type CompilerGateName =
  | "asset_font"
  | "build"
  | "capture"
  | "determinism"
  | "dom"
  | "interaction"
  | "layout"
  | "motion"
  | "perceptual"
  | "pollution"
  | "responsive"
  | "style";

type JsonRecord = Record<string, unknown>;

const artifactGateMap = {
  assets: "asset_font",
  build: "build",
  capture: "capture",
  determinism: "determinism",
  dom: "dom",
  interactions: "interaction",
  layout: "layout",
  motion: "motion",
  pollution: "pollution",
  responsive: "responsive",
  style: "style",
} as const satisfies Record<keyof RemixArtifact["quality"]["gates"], CompilerGateName>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function finiteRatio(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
}

function round4(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function boundedCompilerMessage(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 240) : "";
}

async function compilerRejectionDetail(response: Response) {
  const payload = record(await response.json().catch(() => undefined));
  return [boundedCompilerMessage(payload?.error), boundedCompilerMessage(payload?.reason)]
    .filter(Boolean)
    .join("；");
}

/**
 * Converts the compiler's detailed report into DesignFeed's non-negotiable gate.
 * The compiler scorecard is intentionally ignored because its visual component is
 * weighted; DesignFeed publishes the worst viewport as the product score instead.
 */
export function qualityFromCompilerReport(reportValue: unknown): RemixArtifact["quality"] {
  const report = record(reportValue);
  const compilerGates = record(report?.gates);
  const perceptual = record(compilerGates?.perceptual);
  const perceptualMetrics = record(perceptual?.metrics);
  const diffByViewport = record(perceptualMetrics?.perViewport);
  const layout = record(compilerGates?.layout);
  const layoutMetrics = record(layout?.metrics);
  const layoutByViewport = record(layoutMetrics?.perViewport);

  const viewports = requiredRemixViewports.flatMap((width) => {
    const diff = finiteRatio(diffByViewport?.[String(width)]);
    if (diff === undefined) return [];
    const layoutViewport = record(layoutByViewport?.[String(width)]);
    const layoutDelta = typeof layoutViewport?.leafMedianDelta === "number"
      && Number.isFinite(layoutViewport.leafMedianDelta)
      && layoutViewport.leafMedianDelta >= 0
      ? layoutViewport.leafMedianDelta
      : 10_000;
    return [{
      width,
      visualSimilarity: round4(1 - diff),
      layoutMedianDeltaPx: round4(layoutDelta),
    }];
  });

  const gates = Object.fromEntries(
    Object.entries(artifactGateMap).map(([artifactGate, compilerGate]) => {
      const result = record(compilerGates?.[compilerGate]);
      return [artifactGate, result?.pass === true];
    }),
  ) as RemixArtifact["quality"]["gates"];
  const perceptualPassed = perceptual?.pass === true;
  const hasAllViewports = viewports.length === requiredRemixViewports.length;
  const worstVisualSimilarity = hasAllViewports
    ? Math.min(...viewports.map(({ visualSimilarity }) => visualSimilarity))
    : 0;
  const passed = hasAllViewports
    && worstVisualSimilarity >= 0.9
    && perceptualPassed
    && Object.values(gates).every(Boolean);

  return {
    status: passed ? "passed" : "failed",
    minimumVisualSimilarity: 0.9,
    worstVisualSimilarity,
    maskedPixelRatio: 0,
    viewports,
    gates,
  };
}

export interface RemixCompilerConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface RemixCompilerJob {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cached";
  error?: string;
  verify?: unknown;
}

class RemixCompilerHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "RemixCompilerHttpError";
  }
}

const retryableCompilerStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

function isTransientCompilerError(error: unknown): boolean {
  if (error instanceof RemixCompilerHttpError) return retryableCompilerStatuses.has(error.status);
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "NetworkError") return true;
  const cause = error.cause as { code?: unknown } | undefined;
  return typeof cause?.code === "string"
    && ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT", "UND_ERR_SOCKET"].includes(cause.code);
}

function compilerOrigin(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Remix 编译器地址无效");
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("远程 Remix 编译器必须使用 HTTPS");
  }
  if (url.username || url.password) throw new Error("Remix 编译器地址不能包含凭据");
  return url.origin;
}

function requireJobId(jobId: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(jobId)) throw new Error("Remix 编译任务 ID 无效");
  return jobId;
}

function requirePublicHttpUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("复刻目标地址无效");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("复刻目标只支持 http/https");
  if (url.username || url.password) throw new Error("复刻目标地址不能包含凭据");
  return url.toString();
}

function parseJob(value: unknown): RemixCompilerJob {
  const job = record(value);
  const status = job?.status;
  if (typeof job?.jobId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(job.jobId)) {
    throw new Error("Remix 编译器返回了无效任务");
  }
  if (status !== "queued" && status !== "running" && status !== "succeeded" && status !== "failed" && status !== "cached") {
    throw new Error("Remix 编译器返回了未知状态");
  }
  return {
    jobId: job.jobId,
    status,
    ...(typeof job.error === "string" ? { error: job.error.slice(0, 500) } : {}),
    ...(job.verify !== undefined ? { verify: job.verify } : {}),
  };
}

export function createRemixCompilerClient(config: RemixCompilerConfig, fetcher: typeof fetch = fetch) {
  const baseUrl = compilerOrigin(config.baseUrl);
  const headers = () => ({
    ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    "content-type": "application/json",
  });
  const readStatus = async (jobId: string) => {
    const response = await fetcher(`${baseUrl}/v1/clones/${requireJobId(jobId)}`, {
      headers: headers(),
    });
    if (!response.ok) throw new RemixCompilerHttpError(`无法读取 Remix 编译任务 (${response.status})`, response.status);
    return parseJob(await response.json());
  };
  const readResult = async (jobId: string) => {
    const response = await fetcher(`${baseUrl}/v1/clones/${requireJobId(jobId)}/result`, {
      headers: headers(),
    });
    if (!response.ok) throw new RemixCompilerHttpError(`Remix 编译结果尚不可用 (${response.status})`, response.status);
    return await response.json() as unknown;
  };

  return {
    async start(targetUrl: string) {
      const response = await fetcher(`${baseUrl}/v1/clones`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          url: requirePublicHttpUrl(targetUrl),
          options: {
            asyncVerify: false,
            framework: "next",
            mode: "single",
            preview: true,
            styling: "css",
            verify: true,
            viewports: [...requiredRemixViewports],
          },
        }),
      });
      if (!response.ok) {
        const detail = await compilerRejectionDetail(response);
        throw new Error(`Remix 编译器拒绝任务 (${response.status})${detail ? `：${detail}` : ""}`);
      }
      return parseJob(await response.json());
    },

    async status(jobId: string) {
      return readStatus(jobId);
    },

    async result(jobId: string) {
      return readResult(jobId);
    },

    async waitForResult(
      initialJob: RemixCompilerJob,
      options: { maxTransientFailures?: number; pollIntervalMs?: number; timeoutMs?: number } = {},
    ) {
      const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 720_000, 1_000), 900_000);
      const pollIntervalMs = Math.min(Math.max(options.pollIntervalMs ?? 4_000, 0), 30_000);
      const maxTransientFailures = Math.min(Math.max(options.maxTransientFailures ?? 5, 0), 20);
      const deadline = Date.now() + timeoutMs;
      let job = initialJob;
      let transientFailures = 0;
      const waitForNextPoll = async () => {
        if (pollIntervalMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
      };
      while (true) {
        if (job.status === "succeeded" || job.status === "cached") {
          try {
            return await readResult(job.jobId);
          } catch (error) {
            if (!isTransientCompilerError(error) || transientFailures >= maxTransientFailures || Date.now() >= deadline) {
              throw error;
            }
            transientFailures += 1;
            await waitForNextPoll();
            continue;
          }
        }
        if (job.status === "failed") throw new Error(`Remix 编译失败${job.error ? `：${job.error}` : ""}`);
        if (Date.now() >= deadline) throw new Error("Remix 编译超时");
        await waitForNextPoll();
        try {
          job = await readStatus(job.jobId);
          transientFailures = 0;
        } catch (error) {
          if (!isTransientCompilerError(error) || transientFailures >= maxTransientFailures || Date.now() >= deadline) {
            throw error;
          }
          transientFailures += 1;
        }
      }
    },

    async downloadBundle(jobId: string) {
      const response = await fetcher(`${baseUrl}/v1/clones/${requireJobId(jobId)}/bundle?format=tgz`, {
        headers: headers(),
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`Remix 代码包尚不可用 (${response.status})`);
      const declaredBytes = Number(response.headers.get("content-length") ?? "0");
      if (declaredBytes > 500_000_000) throw new Error("Remix 代码包超过 500MB 上限");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 500_000_000) throw new Error("Remix 代码包超过 500MB 上限");
      // Pass the view rather than its backing buffer. Node 22's WebCrypto
      // rejects ArrayBuffers created by a different realm (for example a
      // Response inside jsdom), while BufferSource views are accepted.
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const computedSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const declaredSha256 = response.headers.get("x-content-sha256");
      if (declaredSha256 && (!/^[a-f0-9]{64}$/i.test(declaredSha256) || declaredSha256.toLowerCase() !== computedSha256)) {
        throw new Error("Remix 代码包 SHA-256 校验失败");
      }
      return { bytes, sha256: computedSha256 };
    },

    async preview(jobId: string, assetPath = "") {
      if (assetPath.split("/").some((segment) => segment === "." || segment === "..") || assetPath.length > 2_048) {
        throw new Error("Remix 预览路径无效");
      }
      const encodedPath = assetPath.split("/").filter(Boolean).map(encodeURIComponent).join("/");
      return fetcher(`${baseUrl}/v1/clones/${requireJobId(jobId)}/app-preview/${encodedPath}`, {
        headers: headers(),
        redirect: "follow",
      });
    },

    bundleUrl(jobId: string) {
      return `${baseUrl}/v1/clones/${requireJobId(jobId)}/bundle?format=tgz`;
    },
  };
}
