import { describe, expect, it } from "vitest";

import { normalizeSubmissionUrl } from "./url-safety";

describe("normalizeSubmissionUrl", () => {
  it("normalizes public HTTP URLs and removes tracking fragments", () => {
    expect(normalizeSubmissionUrl("HTTPS://Example.COM/work/#intro")).toBe(
      "https://example.com/work",
    );
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/file",
    "https://localhost:3000",
    "http://127.0.0.1/admin",
    "http://10.0.0.4",
    "http://172.16.0.1",
    "http://192.168.1.8",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => normalizeSubmissionUrl(url)).toThrow();
  });

  it("rejects embedded credentials", () => {
    expect(() => normalizeSubmissionUrl("https://user:pass@example.com")).toThrow(
      "网址不能包含账号信息",
    );
  });
});
