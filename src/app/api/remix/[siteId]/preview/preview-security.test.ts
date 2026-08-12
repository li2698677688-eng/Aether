import { describe, expect, it } from "vitest";

import { remixPreviewSecurityHeaders } from "./[[...assetPath]]/route";

describe("Remix preview isolation", () => {
  it("places compiler output in an opaque sandbox and blocks data exfiltration", () => {
    const headers = remixPreviewSecurityHeaders("review", "text/html; charset=utf-8");
    const policy = headers.get("content-security-policy") ?? "";

    expect(policy).toContain("sandbox allow-scripts");
    expect(policy).not.toContain("allow-same-origin");
    expect(policy).not.toContain("allow-top-navigation");
    expect(policy).not.toContain("allow-forms");
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("form-action 'none'");
    expect(headers.get("permissions-policy")).toContain("payment=()");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  it("allows short public caching only after publication", () => {
    const headers = remixPreviewSecurityHeaders("public");

    expect(headers.get("cache-control")).toBe("public, max-age=300, stale-while-revalidate=3600");
  });
});
