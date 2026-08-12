import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("production security headers", () => {
  it("serves responsive covers as AVIF with WebP fallback", () => {
    expect(nextConfig.images?.formats).toEqual(["image/avif", "image/webp"]);
  });

  it("applies browser isolation, transport security and a restrictive CSP to every route", async () => {
    const groups = await nextConfig.headers?.();
    const headers = new Map((groups?.[0]?.headers ?? []).map((header) => [header.key, header.value]));

    expect(groups?.[0]?.source).toBe("/(.*)");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
  });
});
