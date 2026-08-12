import { z } from "zod";

import { createAnalysisUploadTicketEntries } from "@/lib/analysis-upload-tickets";
import { canIssueAnalysisUpload } from "@/lib/contracts";
import { isStrongRuntimeSecret } from "@/lib/runtime-health";
import { createOptionalAdminClient } from "@/lib/supabase/server";
import type { SiteStatus } from "@/types/site";

const bodySchema = z.object({ jobId: z.string().uuid(), siteId: z.string().uuid() });

export const maxDuration = 30;

export async function POST(request: Request) {
  const expected = process.env.ANALYSIS_ENQUEUE_SECRET;
  if (!isStrongRuntimeSecret(expected)) return Response.json({ error: "服务尚未安全配置" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "未授权" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "上传请求不符合契约" }, { status: 400 });
  const admin = createOptionalAdminClient();
  if (!admin) return Response.json({ error: "Supabase 管理端未配置" }, { status: 503 });
  const { data: job } = await admin
    .from("analysis_jobs")
    .select("id,status")
    .eq("id", parsed.data.jobId)
    .eq("site_id", parsed.data.siteId)
    .maybeSingle();
  if (!job) return Response.json({ error: "分析任务不存在" }, { status: 404 });
  if (!canIssueAnalysisUpload(job.status as SiteStatus)) {
    return Response.json({ error: "当前任务阶段不能上传截图" }, { status: 409 });
  }
  const bucket = process.env.SUPABASE_PRIVATE_SCREENSHOT_BUCKET ?? "site-screenshots-private";
  const artifactBucket = process.env.SUPABASE_PRIVATE_REMIX_BUCKET ?? "remix_artifacts_private";
  const safeSiteId = parsed.data.siteId;
  const safeJobId = parsed.data.jobId;
  const paths = {
    desktop: `${safeSiteId}/${safeJobId}/desktop.webp`,
    desktopFull: `${safeSiteId}/${safeJobId}/desktop-full.webp`,
    mobile: `${safeSiteId}/${safeJobId}/mobile.webp`,
    mobileFull: `${safeSiteId}/${safeJobId}/mobile-full.webp`,
  };
  const artifactPaths = {
    remixBundle: `${safeSiteId}/${safeJobId}/remix-bundle.tgz`,
    remixEvidence: `${safeSiteId}/${safeJobId}/render-ir.json`,
    source375: `${safeSiteId}/${safeJobId}/source-375.webp`,
    source768: `${safeSiteId}/${safeJobId}/source-768.webp`,
    source1280: `${safeSiteId}/${safeJobId}/source-1280.webp`,
    source1920: `${safeSiteId}/${safeJobId}/source-1920.webp`,
    clone375: `${safeSiteId}/${safeJobId}/clone-375.webp`,
    clone768: `${safeSiteId}/${safeJobId}/clone-768.webp`,
    clone1280: `${safeSiteId}/${safeJobId}/clone-1280.webp`,
    clone1920: `${safeSiteId}/${safeJobId}/clone-1920.webp`,
  };
  const objects = [
    ...Object.entries(paths).map(([key, path]) => ({ bucket, key, path })),
    ...Object.entries(artifactPaths).map(([key, path]) => ({ bucket: artifactBucket, key, path })),
  ];
  const entries = await createAnalysisUploadTicketEntries(admin, objects).catch(() => null);
  if (!entries) return Response.json({ error: "创建上传凭证失败" }, { status: 500 });
  return Response.json({ tickets: Object.fromEntries(entries) });
}
