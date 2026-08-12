import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth-path";

describe("safeNextPath", () => {
  it("keeps an internal destination including its search params", () => {
    expect(safeNextPath("/me/submissions?status=failed")).toBe("/me/submissions?status=failed");
  });

  it("rejects protocol-relative, absolute, backslash, and auth-loop destinations", () => {
    expect(safeNextPath("//evil.example/path")).toBe("/");
    expect(safeNextPath("https://evil.example/path")).toBe("/");
    expect(safeNextPath("/\\evil.example/path")).toBe("/");
    expect(safeNextPath("/login?next=/admin/review")).toBe("/");
  });
});
