import { isLocalDemoAllowed } from "@/lib/demo-runtime";
import { createOptionalServerClient } from "@/lib/supabase/server";

async function getContext(id: string) {
  const supabase = await createOptionalServerClient();
  if (!supabase) return { supabase: null, userId: isLocalDemoAllowed() ? "local-demo" : null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null, id };
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await getContext(id);
  if (!supabase && !isLocalDemoAllowed()) return Response.json({ error: "收藏服务尚未配置" }, { status: 503 });
  if (!userId) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!supabase) return Response.json({ ok: true, demo: true });
  const { data: site } = await supabase.from("sites").select("id").eq("id", id).eq("status", "published").maybeSingle();
  if (!site) return Response.json({ error: "网站不存在或尚未发布" }, { status: 404 });
  const { error } = await supabase.from("favorites").upsert({ site_id: id, user_id: userId });
  if (error) return Response.json({ error: "收藏失败" }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await getContext(id);
  if (!supabase && !isLocalDemoAllowed()) return Response.json({ error: "收藏服务尚未配置" }, { status: 503 });
  if (!userId) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!supabase) return Response.json({ ok: true, demo: true });
  const { error } = await supabase.from("favorites").delete().eq("site_id", id).eq("user_id", userId);
  if (error) return Response.json({ error: "取消收藏失败" }, { status: 500 });
  return Response.json({ ok: true });
}
