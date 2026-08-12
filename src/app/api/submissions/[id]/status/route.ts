import { getDemoJob } from "@/lib/demo-jobs";
import { isLocalDemoAllowed } from "@/lib/demo-runtime";
import {
  mapDemoSubmission,
  mapSubmissionRow,
  type SubmissionDatabaseRow,
} from "@/lib/community-repository";
import { createOptionalServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createOptionalServerClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
    const { data: job } = await supabase
      .from("analysis_jobs")
      .select("id,status,attempts,error_code,duration_ms,created_at,updated_at,sites!inner(id,slug,title,url,submitted_by)")
      .eq("id", id)
      .eq("sites.submitted_by", user.id)
      .maybeSingle();
    return job
      ? Response.json(mapSubmissionRow(job as unknown as SubmissionDatabaseRow))
      : Response.json({ error: "未找到该任务" }, { status: 404 });
  }
  if (!isLocalDemoAllowed()) return Response.json({ error: "投稿状态服务尚未配置" }, { status: 503 });
  const job = getDemoJob(id);
  if (!job) return Response.json({ error: "未找到该任务" }, { status: 404 });
  return Response.json(mapDemoSubmission(job));
}
