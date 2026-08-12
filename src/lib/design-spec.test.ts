import { describe, expect, it } from "vitest";

import { formatConfidence, labelEvidenceSource } from "./design-spec";

describe("design spec evidence labels", () => {
  it("formats confidence as a bounded percentage", () => {
    expect(formatConfidence(0.934)).toBe("93%");
    expect(formatConfidence(4)).toBe("100%");
    expect(formatConfidence(-1)).toBe("0%");
  });

  it("uses explicit Chinese labels for extracted and inferred values", () => {
    expect(labelEvidenceSource("extracted")).toBe("页面提取");
    expect(labelEvidenceSource("inferred")).toBe("AI 推断");
  });
});
