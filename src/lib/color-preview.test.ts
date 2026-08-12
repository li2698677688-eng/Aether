import { describe, expect, it } from "vitest";

import { safeColorPreview } from "@/lib/color-preview";

describe("safeColorPreview", () => {
  it("uses the first reviewed hex token and chooses readable foreground ink", () => {
    expect(safeColorPreview("#F7F7F5 / #090909")).toEqual({ background: "#F7F7F5", color: "#111111" });
    expect(safeColorPreview("brand #090909")).toEqual({ background: "#090909", color: "#FFFFFF" });
  });

  it("does not pass untrusted CSS or network URLs into inline styles", () => {
    expect(safeColorPreview("url(https://tracker.example/pixel) red")).toBeNull();
    expect(safeColorPreview("linear-gradient(red, blue)")).toBeNull();
  });
});
