import { describe, expect, it, vi } from "vitest";

import {
  createRemixCompilerClient,
  qualityFromCompilerReport,
} from "@/lib/remix-compiler";

const requiredGates = [
  "asset_font",
  "build",
  "capture",
  "determinism",
  "dom",
  "interaction",
  "layout",
  "motion",
  "perceptual",
  "pollution",
  "responsive",
  "style",
] as const;

function compilerReport(overrides?: { missingWidth?: number; failingGate?: string; diff1280?: number }) {
  const perViewport: Record<string, number> = {
    "375": 0.04,
    "768": 0.0247,
    "1280": overrides?.diff1280 ?? 0.0148,
    "1920": 0.0099,
  };
  if (overrides?.missingWidth) delete perViewport[String(overrides.missingWidth)];

  const layoutPerViewport = Object.fromEntries(
    Object.keys(perViewport).map((width) => [width, { leafMedianDelta: width === "375" ? 0.86 : 0.8 }]),
  );
  return {
    status: "pass",
    gates: Object.fromEntries(requiredGates.map((gate) => [gate, {
      pass: gate !== overrides?.failingGate,
      metrics: gate === "perceptual"
        ? { perViewport, worstDiffPct: Math.max(...Object.values(perViewport)), threshold: 0.1 }
        : gate === "layout"
          ? { perViewport: layoutPerViewport }
          : {},
    }])),
  };
}

describe("compiler report hard gate", () => {
  it("derives the public score from the worst viewport rather than the weighted scorecard", () => {
    const quality = qualityFromCompilerReport(compilerReport());

    expect(quality.status).toBe("passed");
    expect(quality.worstVisualSimilarity).toBe(0.96);
    expect(quality.viewports.map(({ width }) => width)).toEqual([375, 768, 1280, 1920]);
  });

  it("fails when one viewport is below 90%, even if the compiler says pass", () => {
    const quality = qualityFromCompilerReport(compilerReport({ diff1280: 0.1001 }));

    expect(quality.status).toBe("failed");
    expect(quality.worstVisualSimilarity).toBe(0.8999);
  });

  it("fails closed when a required viewport or non-visual gate is missing", () => {
    expect(qualityFromCompilerReport(compilerReport({ missingWidth: 768 })).status).toBe("failed");
    expect(qualityFromCompilerReport(compilerReport({ failingGate: "dom" })).status).toBe("failed");
  });
});

describe("Remix compiler client", () => {
  it("starts a deterministic four-viewport verified clone without exposing the key in the body", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      jobId: "job_abc123",
      status: "queued",
    }), { status: 202 }));
    const client = createRemixCompilerClient({
      apiKey: "secret-compiler-key",
      baseUrl: "https://compiler.designfeed.example",
    }, fetchMock);

    await expect(client.start("https://example.com/")).resolves.toEqual({ jobId: "job_abc123", status: "queued" });
    const [requestUrl, init] = fetchMock.mock.calls[0]!;
    expect(requestUrl).toBe("https://compiler.designfeed.example/v1/clones");
    expect(init?.headers).toEqual(expect.objectContaining({ authorization: "Bearer secret-compiler-key" }));
    expect(init?.body).not.toContain("secret-compiler-key");
    expect(JSON.parse(String(init?.body))).toEqual({
      url: "https://example.com/",
      options: {
        asyncVerify: false,
        framework: "next",
        mode: "single",
        preview: true,
        styling: "css",
        verify: true,
        viewports: [375, 768, 1280, 1920],
      },
    });
  });

  it("preserves a bounded compiler rejection reason for diagnosis", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: "url not allowed",
      reason: "blocked address for sive.rs: 198.18.0.198",
    }), { status: 400 }));
    const client = createRemixCompilerClient({
      apiKey: "secret-compiler-key",
      baseUrl: "https://compiler.designfeed.example",
    }, fetchMock);

    await expect(client.start("https://sive.rs/"))
      .rejects.toThrow("url not allowed；blocked address for sive.rs: 198.18.0.198");
  });

  it("rejects insecure remote compiler endpoints and unsafe job ids", async () => {
    expect(() => createRemixCompilerClient({ baseUrl: "http://compiler.example" })).toThrow("HTTPS");
    const client = createRemixCompilerClient({ baseUrl: "http://127.0.0.1:8787" });

    await expect(client.status("../secret")).rejects.toThrow("任务 ID");
  });

  it("polls an asynchronous job, reads its verified result, and downloads the hashed bundle", async () => {
    const bundleSha256 = "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81";
    const result = { jobId: "job_abc123", status: "succeeded", verify: compilerReport() };
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job_abc123", status: "running" })))
      .mockResolvedValueOnce(new Response(JSON.stringify(result)))
      .mockResolvedValueOnce(new Response(JSON.stringify(result)))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        headers: { "x-content-sha256": bundleSha256 },
      }));
    const client = createRemixCompilerClient({ baseUrl: "https://compiler.designfeed.example" }, fetchMock);

    await expect(client.waitForResult(
      { jobId: "job_abc123", status: "queued" },
      { pollIntervalMs: 0, timeoutMs: 1_000 },
    )).resolves.toEqual(result);
    const bundle = await client.downloadBundle("job_abc123");
    expect([...bundle.bytes]).toEqual([1, 2, 3]);
    expect(bundle.sha256).toBe(bundleSha256);
  });

  it("recovers from a transient polling reset without turning a successful clone into a failure", async () => {
    const result = { jobId: "job_abc123", status: "succeeded", verify: compilerReport() };
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: new Error("ECONNRESET") }))
      .mockResolvedValueOnce(new Response(JSON.stringify(result)))
      .mockResolvedValueOnce(new Response(JSON.stringify(result)));
    const client = createRemixCompilerClient({ baseUrl: "https://compiler.designfeed.example" }, fetchMock);

    await expect(client.waitForResult(
      { jobId: "job_abc123", status: "queued" },
      { pollIntervalMs: 0, timeoutMs: 1_000 },
    )).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries temporary compiler HTTP failures but fails immediately on authentication errors", async () => {
    const result = { jobId: "job_abc123", status: "succeeded", verify: compilerReport() };
    const temporaryFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(result)))
      .mockResolvedValueOnce(new Response(JSON.stringify(result)));
    const temporaryClient = createRemixCompilerClient(
      { baseUrl: "https://compiler.designfeed.example" },
      temporaryFetch,
    );

    await expect(temporaryClient.waitForResult(
      { jobId: "job_abc123", status: "queued" },
      { pollIntervalMs: 0, timeoutMs: 1_000 },
    )).resolves.toEqual(result);

    const authFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    const authClient = createRemixCompilerClient(
      { baseUrl: "https://compiler.designfeed.example" },
      authFetch,
    );
    await expect(authClient.waitForResult(
      { jobId: "job_abc123", status: "queued" },
      { pollIntervalMs: 0, timeoutMs: 1_000 },
    )).rejects.toThrow("401");
    expect(authFetch).toHaveBeenCalledTimes(1);
  });
});
