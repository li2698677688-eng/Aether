import type { NextRequest } from "next/server";

import { getPublishedSitePage } from "@/lib/site-repository";
import { siteCategories, type SiteCategory } from "@/types/site";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawCategory = params.get("category");
  const category = siteCategories.includes(rawCategory as SiteCategory) ? rawCategory as SiteCategory : "全部";
  const page = await getPublishedSitePage({
    q: params.get("q") ?? undefined,
    category,
    sort: params.get("sort") === "latest" ? "latest" : "featured",
    cursor: params.get("cursor"),
    limit: Number(params.get("limit")) || 12,
  });
  return Response.json(page, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
