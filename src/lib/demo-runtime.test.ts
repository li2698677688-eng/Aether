import { describe, expect, it } from "vitest";

import { isLocalDemoAllowed } from "@/lib/demo-runtime";

describe("local demo runtime", () => {
  it("is available for development and tests", () => {
    expect(isLocalDemoAllowed("development")).toBe(true);
    expect(isLocalDemoAllowed("test")).toBe(true);
  });

  it("fails closed in production", () => {
    expect(isLocalDemoAllowed("production")).toBe(false);
  });
});
