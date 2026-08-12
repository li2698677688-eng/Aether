import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth-path";
import { isLocalDemoAllowed } from "@/lib/demo-runtime";
import { createOptionalServerClient } from "@/lib/supabase/server";

export interface Viewer {
  id: string;
  email?: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: "user" | "admin";
  demo: boolean;
}

export const demoViewer: Viewer = {
  id: "local-demo",
  username: "designfeed",
  displayName: "DesignFeed 设计师",
  role: "admin",
  demo: true,
};

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createOptionalServerClient();
  if (!supabase) return isLocalDemoAllowed() ? demoViewer : null;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("username,display_name,avatar_url,role")
    .eq("id", user.id)
    .maybeSingle();
  const username = profile?.username || user.email?.split("@")[0] || `user-${user.id.slice(0, 8)}`;
  return {
    id: user.id,
    email: user.email,
    username,
    displayName: profile?.display_name || user.user_metadata.full_name || username,
    avatarUrl: profile?.avatar_url || user.user_metadata.avatar_url || undefined,
    role: profile?.role === "admin" ? "admin" : "user",
    demo: false,
  };
}

export async function requireViewer(nextPath: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  return viewer;
}

export async function requireAdmin(nextPath = "/admin/review"): Promise<Viewer> {
  const viewer = await requireViewer(nextPath);
  if (viewer.role !== "admin") redirect("/");
  return viewer;
}
