import type { EvidenceMeta } from "@/types/site";

export function formatConfidence(confidence: number) {
  return `${Math.round(Math.min(Math.max(confidence, 0), 1) * 100)}%`;
}

export function labelEvidenceSource(source: EvidenceMeta["source"]) {
  return source === "extracted" ? "页面提取" : "AI 推断";
}
