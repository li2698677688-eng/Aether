import { Suspense } from "react";

import { FeedShell } from "@/components/feed/feed-shell";
import { getPublishedSitePage } from "@/lib/site-repository";
import { siteCategories, type SiteCategory } from "@/types/site";

export const revalidate = 60;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawCategory = first(params.category);
  const category = siteCategories.includes(rawCategory as SiteCategory) ? rawCategory as SiteCategory : "全部";
  const initialPage = await getPublishedSitePage({
    q: first(params.q),
    category,
    sort: first(params.sort) === "latest" ? "latest" : "featured",
    limit: 12,
  });
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <FeedShell initialPage={initialPage} />
    </Suspense>
  );
}
