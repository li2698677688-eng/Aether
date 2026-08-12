import type { NextRequest } from "next/server";

import { featuredSites } from "@/data/sites";
import { submissionSchema } from "@/lib/contracts";
import { countPendingDemoJobs, countRecentDemoJobs, createDemoJob, findDemoJobByUrl } from "@/lib/demo-jobs";
import { isLocalDemoAllowed } from "@/lib/demo-runtime";
import { isAnalysisRuntimeConfigured } from "@/lib/runtime-health";
import { createOptionalServerClient } from "@/lib/supabase/server";
import { normalizeSubmissionUrl } from "@/lib/url-safety";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "请输入有效的 http/https 网站地址" }, { status: 400 });

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeSubmissionUrl(parsed.data.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "网站地址无法访问";
    return Response.json({ error: message }, { status: 400 });
  }

  const supabase = await createOptionalServerClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "请先登录后投稿" }, { status: 401 });
    const hostname = new URL(normalizedUrl).hostname.replace(/^www\./, "");
    const slug = `${hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await supabase.rpc("submit_site", {
      p_normalized_url: normalizedUrl,
      p_slug: slug,
      p_title: hostname,
      p_url: normalizedUrl,
    });
    if (error) {
      if (error.message.includes("DUPLICATE_SITE")) return Response.json({ error: "这个网站已经收录或正在处理" }, { status: 409 });
      if (error.message.includes("DAILY_LIMIT_REACHED")) return Response.json({ error: "今天的 3 次投稿额度已经用完" }, { status: 429 });
      if (error.message.includes("PENDING_LIMIT_REACHED")) return Response.json({ error: "当前已有 5 个待处理任务，请稍后再试" }, { status: 429 });
      return Response.json({ error: "创建投稿失败" }, { status: 500 });
    }
    const created = (data as Array<{ site_id: string; job_id: string }> | null)?.[0];
    if (!created) return Response.json({ error: "创建分析任务失败" }, { status: 500 });
    const markEnqueueFailed = (errorCode: string) => supabase.rpc("fail_submission_enqueue", {
      p_error_code: errorCode,
      p_job_id: created.job_id,
      p_site_id: created.site_id,
    });

    const queueUrl = process.env.ANALYSIS_ENQUEUE_URL;
    const queueSecret = process.env.ANALYSIS_ENQUEUE_SECRET;
    if (!queueUrl || !queueSecret || !isAnalysisRuntimeConfigured(process.env)) {
      const { error: failureError } = await markEnqueueFailed("QUEUE_NOT_CONFIGURED");
      if (failureError) return Response.json({ error: "投稿已保存，但任务状态需要人工核对" }, { status: 500 });
      return Response.json({ id: created.job_id, normalizedUrl, status: "failed", warning: "投稿已保存，但采集队列尚未配置。" }, { status: 202 });
    }
    const queued = await fetch(queueUrl, {
        body: JSON.stringify({ jobId: created.job_id, siteId: created.site_id, url: normalizedUrl }),
        headers: { authorization: `Bearer ${queueSecret}`, "content-type": "application/json" },
        method: "POST",
      }).catch(() => null);
    if (!queued?.ok) {
      const { error: failureError } = await markEnqueueFailed("QUEUE_ENQUEUE_FAILED");
      if (failureError) return Response.json({ error: "投稿已保存，但任务状态需要人工核对" }, { status: 500 });
      return Response.json({ id: created.job_id, normalizedUrl, status: "failed", warning: "投稿已保存，但暂时无法加入采集队列。" }, { status: 202 });
    }
    return Response.json({ id: created.job_id, normalizedUrl, status: "queued" }, { status: 202 });
  }

  if (!isLocalDemoAllowed()) {
    return Response.json({ error: "投稿服务尚未配置" }, { status: 503 });
  }
  const duplicate = featuredSites.some((site) => normalizeSubmissionUrl(site.url) === normalizedUrl) || findDemoJobByUrl(normalizedUrl);
  if (duplicate) return Response.json({ error: "这个网站已经收录或正在处理" }, { status: 409 });
  const requester = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-demo";
  if (countRecentDemoJobs(requester, Date.now() - 86_400_000) >= 3) {
    return Response.json({ error: "今天的 3 次投稿额度已经用完" }, { status: 429 });
  }
  if (countPendingDemoJobs(requester) >= 5) {
    return Response.json({ error: "当前已有 5 个待处理任务，请稍后再试" }, { status: 429 });
  }

  const job = createDemoJob(normalizedUrl, requester);
  return Response.json({ id: job.id, normalizedUrl, status: job.status }, { status: 202 });
}
