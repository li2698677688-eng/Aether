import { isLocalDemoAllowed } from "@/lib/demo-runtime";
import { createOptionalServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createOptionalServerClient();
  if (!supabase) {
    return isLocalDemoAllowed()
      ? Response.json({ ids: [], demo: true })
      : Response.json({ error: "收藏服务尚未配置" }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const { data, error } = await supabase
    .from("favorites")
    .select("site_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return Response.json({ error: "收藏列表加载失败" }, { status: 500 });
  return Response.json({ ids: (data ?? []).map((entry) => entry.site_id) }, {
    headers: { "cache-control": "private, no-store" },
  });
}
