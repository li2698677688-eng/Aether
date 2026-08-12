import type { SiteStatus } from "@/types/site";

export const activeSubmissionStatuses = new Set<SiteStatus>([
  "queued",
  "capturing",
  "analyzing",
  "in_review",
]);

export function statusPresentation(status: SiteStatus) {
  return {
    queued: { label: "等待采集", progress: 10 },
    capturing: { label: "正在采集", progress: 34 },
    analyzing: { label: "正在分析", progress: 62 },
    in_review: { label: "等待审核", progress: 88 },
    published: { label: "已发布", progress: 100 },
    rejected: { label: "未通过", progress: 100 },
    failed: { label: "处理失败", progress: 100 },
  }[status];
}
