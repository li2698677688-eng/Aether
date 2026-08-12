import { getViewer } from "@/lib/auth";
import { adminReviewBodySchema, canTransitionStatus, designSpecSchema } from "@/lib/contracts";
import { parseReviewableRemixRow, type RemixDeliveryRow } from "@/lib/remix-delivery";
import { isAnalysisRuntimeConfigured } from "@/lib/runtime-health";
import { createOptionalServerClient } from "@/lib/supabase/server";
import type { SiteStatus } from "@/types/site";

const actions = {
  approve: "published",
  reject: "rejected",
  retry: "queued",
} satisfies Record<string, SiteStatus>;

export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  if (!(action in actions)) return Response.json({ error: "不支持的审核操作" }, { status: 404 });
  const parsed = adminReviewBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "审核内容不符合契约" }, { status: 400 });

  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "请先登录" }, { status: 401 });
  if (viewer.role !== "admin") return Response.json({ error: "没有管理员权限" }, { status: 403 });
  if (viewer.demo) return Response.json({ ok: true, status: actions[action as keyof typeof actions], demo: true });

  const supabase = await createOptionalServerClient();
  if (!supabase) return Response.json({ error: "Supabase 未配置" }, { status: 503 });
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id,status,design_spec,remix_artifact,remix_bundle_path,remix_evidence_path,remix_compiler_job_id")
    .eq("id", id)
    .maybeSingle();
  if (siteError) return Response.json({ error: "读取审核项目失败" }, { status: 500 });
  if (!site) return Response.json({ error: "未找到审核项目" }, { status: 404 });
  const targetStatus = actions[action as keyof typeof actions];
  if (!canTransitionStatus(site.status, targetStatus)) {
    return Response.json({ error: "当前状态不允许执行这个审核操作" }, { status: 409 });
  }

  if (action === "approve") {
    if (site.status !== "in_review") return Response.json({ error: "只有待审核项目可以发布" }, { status: 409 });
    const reviewedSpec = parsed.data.designSpec ?? site.design_spec;
    if (!designSpecSchema.safeParse(reviewedSpec).success) return Response.json({ error: "设计规范缺失或无效，请重新分析" }, { status: 409 });
    if (!parsed.data.category) return Response.json({ error: "请选择公开分类" }, { status: 400 });
    if (!parsed.data.remixArtifactReviewed) return Response.json({ error: "请先检查并确认复刻证据" }, { status: 409 });
    if (!parseReviewableRemixRow(site as RemixDeliveryRow, site.id)) {
      return Response.json({ error: "复刻产物缺失、未通过 90% 硬门槛或存储证据不完整" }, { status: 409 });
    }
    const { error } = await supabase.rpc("review_site", {
      p_action: "approve",
      p_category_name: parsed.data.category,
      p_design_spec: parsed.data.designSpec ?? null,
      p_reason: null,
      p_remix_prompt: null,
      p_site_id: id,
    });
    if (error) {
      if (error.message.includes("CATEGORY_NOT_FOUND")) return Response.json({ error: "公开分类不存在" }, { status: 400 });
      if (error.message.includes("STALE_REVIEW_STATE") || error.message.includes("ANALYSIS_JOB_NOT_IN_REVIEW")) {
        return Response.json({ error: "审核状态已变化，请刷新后重试" }, { status: 409 });
      }
      if (error.message.includes("REMIX_ARTIFACT_QUALITY_REQUIRED")) {
        return Response.json({ error: "复刻产物未通过发布硬门槛，请重新分析" }, { status: 409 });
      }
      return Response.json({ error: "发布事务失败，未写入任何审核结果" }, { status: 500 });
    }
    return Response.json({ ok: true, status: "published" });
  } else if (action === "reject") {
    if (!parsed.data.reason || parsed.data.reason.length < 3) return Response.json({ error: "请填写至少 3 个字的驳回原因" }, { status: 400 });
    const { error } = await supabase.rpc("review_site", {
      p_action: "reject",
      p_category_name: null,
      p_design_spec: null,
      p_reason: parsed.data.reason,
      p_remix_prompt: null,
      p_site_id: id,
    });
    if (error) {
      if (error.message.includes("STALE_REVIEW_STATE") || error.message.includes("ANALYSIS_JOB_NOT_IN_REVIEW")) {
        return Response.json({ error: "审核状态已变化，请刷新后重试" }, { status: 409 });
      }
      return Response.json({ error: "驳回事务失败，未写入任何审核结果" }, { status: 500 });
    }
    return Response.json({ ok: true, status: "rejected" });
  } else {
    const queueUrl = process.env.ANALYSIS_ENQUEUE_URL;
    const queueSecret = process.env.ANALYSIS_ENQUEUE_SECRET;
    if (!queueUrl || !queueSecret || !isAnalysisRuntimeConfigured(process.env)) {
      return Response.json({ error: "采集队列尚未安全配置" }, { status: 503 });
    }
    const { data: retryRows, error: retryError } = await supabase.rpc("retry_site_analysis", { p_site_id: id });
    if (retryError) {
      if (retryError.message.includes("ANALYSIS_JOB_NOT_FOUND")) return Response.json({ error: "未找到分析任务" }, { status: 404 });
      if (retryError.message.includes("STALE_")) return Response.json({ error: "任务状态已变化，请刷新后重试" }, { status: 409 });
      return Response.json({ error: "无法准备重试任务" }, { status: 500 });
    }
    const retry = (retryRows as Array<{ job_id: string; url: string }> | null)?.[0];
    if (!retry) return Response.json({ error: "无法读取重试任务" }, { status: 500 });
    const queued = await fetch(queueUrl, {
      body: JSON.stringify({ jobId: retry.job_id, siteId: id, url: retry.url }),
      headers: { authorization: `Bearer ${queueSecret}`, "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    if (!queued?.ok) {
      const { error: failureError } = await supabase.rpc("fail_analysis_retry", {
        p_error_code: "QUEUE_ENQUEUE_FAILED",
        p_job_id: retry.job_id,
        p_site_id: id,
      });
      if (failureError) return Response.json({ error: "入队失败，且任务状态需要人工核对" }, { status: 500 });
      return Response.json({ error: "重新加入采集队列失败" }, { status: 503 });
    }
    return Response.json({ ok: true, status: "queued" });
  }
}
