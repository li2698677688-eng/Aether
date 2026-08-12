import { analysisCallbackSchema, canApplyAnalysisCallbackTransition } from "@/lib/contracts";
import { claimDemoWebhookSignature, getDemoJob, updateDemoJob } from "@/lib/demo-jobs";
import { isLocalDemoAllowed } from "@/lib/demo-runtime";
import { isStrongRuntimeSecret } from "@/lib/runtime-health";
import { createOptionalAdminClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/webhook-signature";

export const maxDuration = 30;

export async function POST(request: Request) {
  const secret = process.env.ANALYSIS_CALLBACK_SECRET;
  if (!isStrongRuntimeSecret(secret)) return Response.json({ error: "回调密钥未安全配置" }, { status: 503 });
  const body = await request.text();
  const timestamp = Number(request.headers.get("x-designfeed-timestamp"));
  const signature = request.headers.get("x-designfeed-signature") ?? "";
  if (!verifyWebhookSignature({ body, timestamp, signature, secret })) {
    return Response.json({ error: "签名无效或回调已过期" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return Response.json({ error: "回调内容不是有效 JSON" }, { status: 400 });
  }
  const parsed = analysisCallbackSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "回调内容不符合契约" }, { status: 400 });

  const admin = createOptionalAdminClient();
  if (!admin) {
    if (!isLocalDemoAllowed()) return Response.json({ error: "分析存储尚未配置" }, { status: 503 });
    if (!claimDemoWebhookSignature(signature)) return Response.json({ error: "重复回调" }, { status: 409 });
    const current = getDemoJob(parsed.data.jobId);
    if (!current) return Response.json({ error: "未找到任务" }, { status: 404 });
    if (!canApplyAnalysisCallbackTransition(
      current.status,
      parsed.data.status,
      current.attempts,
      parsed.data.attempts,
    )) {
      return Response.json({ error: "不允许的状态跳转" }, { status: 409 });
    }
    updateDemoJob(current.id, { status: parsed.data.status, errorCode: parsed.data.errorCode, attempts: parsed.data.attempts ?? current.attempts });
    return Response.json({ ok: true, demo: true });
  }

  const patch = Object.fromEntries(Object.entries({
    title: parsed.data.title,
    summary: parsed.data.summary,
    finalUrl: parsed.data.finalUrl,
    embedStatus: parsed.data.embedStatus,
    screenshotDesktop: parsed.data.screenshotDesktop,
    screenshotDesktopFull: parsed.data.screenshotDesktopFull,
    screenshotMobile: parsed.data.screenshotMobile,
    screenshotMobileFull: parsed.data.screenshotMobileFull,
    extraction: parsed.data.extraction,
    designSpec: parsed.data.designSpec,
    remixArtifact: parsed.data.remixArtifact,
    remixBundlePath: parsed.data.remixBundlePath,
    remixEvidencePath: parsed.data.remixEvidencePath,
    remixCompilerJobId: parsed.data.remixCompilerJobId,
  }).filter((entry) => entry[1] !== undefined));
  const { data: applyResult, error: applyError } = await admin.rpc("apply_analysis_callback", {
    p_attempts: parsed.data.attempts,
    p_duration_ms: parsed.data.durationMs,
    p_error_code: parsed.data.errorCode,
    p_job_id: parsed.data.jobId,
    p_patch: patch,
    p_signature: signature,
    p_status: parsed.data.status,
  });
  if (applyError) return Response.json({ error: "回调写入失败" }, { status: 500 });
  if (applyResult === "duplicate") return Response.json({ error: "重复回调" }, { status: 409 });
  if (applyResult === "not_found") return Response.json({ error: "未找到任务" }, { status: 404 });
  if (applyResult === "stale_attempt") return Response.json({ error: "过期的任务尝试" }, { status: 409 });
  if (applyResult === "invalid_attempt") return Response.json({ error: "任务尝试次数无效" }, { status: 400 });
  if (applyResult === "invalid_transition") return Response.json({ error: "不允许的状态跳转" }, { status: 409 });
  if (applyResult !== "applied") return Response.json({ error: "回调结果无效" }, { status: 500 });
  return Response.json({ ok: true });
}
