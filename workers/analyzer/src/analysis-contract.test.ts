import { describe, expect, it } from "vitest";

import { appRequestHeaders, assertCompleteRenderEvidence, authorizedRequestHeaders, clampFullPageHeight, createNavigationRequestBudget, detectEmbedStatus, encodeRemixEvidence, isMainDocumentWithinLimit, isPrivateNetworkAddress, isStrongSharedSecret, isValidAppBaseUrl, normalizePageMetadata, resolveAnalysisOutputs, withAsyncResource } from "./analysis-contract";

describe("analyzer result contracts", () => {
  it("marks pages with X-Frame-Options or restrictive frame-ancestors as screenshot only", () => {
    expect(detectEmbedStatus({ "x-frame-options": "DENY" })).toBe("screenshot_only");
    expect(detectEmbedStatus({ "x-frame-options": "sameorigin" })).toBe("screenshot_only");
    expect(detectEmbedStatus({ "content-security-policy": "default-src 'self'; frame-ancestors 'self' https://partner.example" })).toBe("screenshot_only");
  });

  it("allows cross-origin preview only when headers do not prohibit it", () => {
    expect(detectEmbedStatus({})).toBe("embeddable");
    expect(detectEmbedStatus({ "content-security-policy": "frame-ancestors *" })).toBe("embeddable");
    expect(detectEmbedStatus({ "content-security-policy": "frame-ancestors https:" }, "https://designfeed.example")).toBe("embeddable");
    expect(detectEmbedStatus(
      { "content-security-policy": "frame-ancestors https://designfeed.example" },
      "https://designfeed.example",
    )).toBe("embeddable");
  });

  it("rejects oversized main documents before screenshots and AI analysis", () => {
    expect(isMainDocumentWithinLimit({ "content-length": "4999999" })).toBe(true);
    expect(isMainDocumentWithinLimit({ "content-length": "5000001" })).toBe(false);
    expect(isMainDocumentWithinLimit({})).toBe(true);
    expect(isMainDocumentWithinLimit({}, 5_000_001)).toBe(false);
  });

  it("bounds untrusted page title and summary before sending callbacks or AI input", () => {
    expect(normalizePageMetadata({ title: `  ${"A".repeat(300)}  `, description: " B ".repeat(500) })).toEqual({
      title: "A".repeat(200),
      summary: "B ".repeat(249) + "B",
    });
  });

  it("caps pathological full-page captures while preserving normal pages", () => {
    expect(clampFullPageHeight(8_400)).toBe(8_400);
    expect(clampFullPageHeight(50_000)).toBe(12_000);
    expect(clampFullPageHeight(Number.NaN)).toBe(900);
  });

  it("fails closed when the Render IR is truncated or structurally incomplete", () => {
    expect(() => assertCompleteRenderEvidence({ nodeCount: 6_001, nodes: Array(6_000), truncated: true }))
      .toThrow("REMIX_EVIDENCE_TRUNCATED");
    expect(() => assertCompleteRenderEvidence({ nodeCount: 3, nodes: [{}, {}], truncated: false }))
      .toThrow("REMIX_EVIDENCE_INCOMPLETE");
    expect(() => assertCompleteRenderEvidence({ nodeCount: 2, nodes: [{}, {}], truncated: false }))
      .not.toThrow();
  });

  it("keeps a verified Remix bundle when the optional DesignSpec model is unavailable", () => {
    expect(resolveAnalysisOutputs(
      { status: "rejected", reason: new Error("DESIGN_SPEC_FAILED") },
      { status: "fulfilled", value: { artifactId: "remix-1" } },
    )).toEqual({ designSpec: undefined, remix: { artifactId: "remix-1" } });

    expect(() => resolveAnalysisOutputs(
      { status: "fulfilled", value: { version: "1.0" } },
      { status: "rejected", reason: new Error("REMIX_QUALITY_BELOW_90") },
    )).toThrow("REMIX_QUALITY_BELOW_90");
  });

  it("binds the exact raw compiler report into the stored evidence document", () => {
    const bytes = encodeRemixEvidence({
      capturedAt: "2026-08-06T08:00:00.000Z",
      compilerJobId: "job-1",
      compilerVersion: "0.1.0",
      compilerVerify: { gates: { perceptual: { pass: true } } },
      viewports: [{ nodeCount: 2, nodes: [{}, {}], truncated: false }],
    });
    const document = JSON.parse(new TextDecoder().decode(bytes));

    expect(document).toMatchObject({
      version: "2.0",
      compiler: {
        jobId: "job-1",
        version: "0.1.0",
        verify: { gates: { perceptual: { pass: true } } },
      },
    });
  });

  it("resets the per-navigation request cap without allowing infinite navigation churn", () => {
    const budget = createNavigationRequestBudget(2, 4);

    expect([budget.take(), budget.take(), budget.take()]).toEqual([true, true, false]);
    budget.startNavigation();
    expect([budget.take(), budget.take(), budget.take()]).toEqual([true, true, false]);
    budget.startNavigation();
    expect(budget.take()).toBe(false);
  });

  it("accepts only an explicit production HTTPS origin for callbacks", () => {
    expect(isValidAppBaseUrl("https://designfeed.app")).toBe(true);
    expect(isValidAppBaseUrl("https://preview.designfeed.app/")).toBe(true);
    expect(isValidAppBaseUrl("https://designfeed.example")).toBe(false);
    expect(isValidAppBaseUrl("http://designfeed.app")).toBe(false);
    expect(isValidAppBaseUrl("https://127.0.0.1")).toBe(false);
    expect(isValidAppBaseUrl("https://[::1]")).toBe(false);
    expect(isValidAppBaseUrl("https://designfeed.app/path")).toBe(false);
    expect(isValidAppBaseUrl("https://user:pass@designfeed.app")).toBe(false);
    expect(isValidAppBaseUrl("not-a-url")).toBe(false);
  });

  it("requires high-entropy shared secrets before accepting work", () => {
    expect(isStrongSharedSecret("x".repeat(32))).toBe(true);
    expect(isStrongSharedSecret("short-secret")).toBe(false);
    expect(isStrongSharedSecret(undefined)).toBe(false);
  });

  it("sends the compiler bearer key only to the exact compiler origin", () => {
    const authorizedOrigin = {
      apiKey: "compiler-secret",
      origin: "https://compiler.designfeed.app",
    };

    expect(authorizedRequestHeaders(
      new URL("https://compiler.designfeed.app/v1/clones/job/app-preview/"),
      { accept: "text/html" },
      authorizedOrigin,
    )).toEqual({ accept: "text/html", authorization: "Bearer compiler-secret" });
    expect(authorizedRequestHeaders(
      new URL("https://assets.example/logo.svg"),
      { accept: "image/svg+xml" },
      authorizedOrigin,
    )).toBeUndefined();
    expect(authorizedRequestHeaders(
      new URL("https://compiler.designfeed.app.attacker.example/steal"),
      {},
      authorizedOrigin,
    )).toBeUndefined();
  });

  it("sends a strong deployment bypass only to DesignFeed internal requests", () => {
    const baseHeaders = { authorization: "Bearer enqueue-secret", "content-type": "application/json" };

    expect(appRequestHeaders(baseHeaders, "v".repeat(32))).toEqual({
      ...baseHeaders,
      "x-vercel-protection-bypass": "v".repeat(32),
    });
    expect(appRequestHeaders(baseHeaders, "short")).toEqual(baseHeaders);
    expect(appRequestHeaders(baseHeaders)).toEqual(baseHeaders);
  });

  it("always closes a browser phase before the next long-running phase begins", async () => {
    const events: string[] = [];
    const result = await withAsyncResource(
      async () => ({ close: async () => { events.push("close"); } }),
      async () => { events.push("capture"); return "evidence"; },
    );
    events.push("compile");

    expect(result).toBe("evidence");
    expect(events).toEqual(["capture", "close", "compile"]);

    await expect(withAsyncResource(
      async () => ({ close: async () => { events.push("close-after-error"); } }),
      async () => { throw new Error("capture failed"); },
    )).rejects.toThrow("capture failed");
    expect(events.at(-1)).toBe("close-after-error");
  });

  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "[::1]", "[fd00::1]", "[fe80::1]"])(
    "recognizes private or link-local address %s",
    (address) => expect(isPrivateNetworkAddress(address)).toBe(true),
  );

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "designfeed.app"])(
    "does not classify public address %s as private",
    (address) => expect(isPrivateNetworkAddress(address)).toBe(false),
  );
});
