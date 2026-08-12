import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { createOptionalAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  siteId: z.string().uuid(),
  variant: z.enum(["desktop", "desktop-full", "mobile", "mobile-full"]),
});

const fields = {
  desktop: "screenshot_desktop",
  "desktop-full": "screenshot_desktop_full",
  mobile: "screenshot_mobile",
  "mobile-full": "screenshot_mobile_full",
} as const;

interface ScreenshotRow {
  status: string;
  screenshot_desktop: string | null;
  screenshot_desktop_full: string | null;
  screenshot_mobile: string | null;
  screenshot_mobile_full: string | null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; variant: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "截图地址无效" }, { status: 400 });
  const admin = createOptionalAdminClient();
  if (!admin) return Response.json({ error: "截图存储未配置" }, { status: 503 });
  const field = fields[parsed.data.variant];
  const { data: site, error: siteError } = await admin
    .from("sites")
    .select("status,screenshot_desktop,screenshot_desktop_full,screenshot_mobile,screenshot_mobile_full")
    .eq("id", parsed.data.siteId)
    .maybeSingle();
  if (siteError) return Response.json({ error: "截图读取失败" }, { status: 500 });
  if (!site) return Response.json({ error: "截图不存在" }, { status: 404 });
  if (site.status !== "published") {
    const viewer = await getViewer();
    if (!viewer || viewer.role !== "admin") return Response.json({ error: "截图不存在" }, { status: 404 });
  }
  const path = (site as ScreenshotRow)[field];
  if (!path) return Response.json({ error: "截图不存在" }, { status: 404 });

  if (/^https:\/\//.test(path)) {
    const storageHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : "";
    const legacyUrl = new URL(path);
    if (legacyUrl.hostname !== storageHost) return Response.json({ error: "截图来源无效" }, { status: 409 });
    return Response.redirect(legacyUrl, 307);
  }

  const bucket = process.env.SUPABASE_PRIVATE_SCREENSHOT_BUCKET ?? "site-screenshots-private";
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return Response.json({ error: "截图文件不存在" }, { status: 404 });
  return new Response(data, {
    headers: {
      "cache-control": site.status === "published" ? "public, s-maxage=86400, stale-while-revalidate=604800" : "private, no-store",
      "content-type": data.type || "image/webp",
    },
  });
}
