import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteDetailShell } from "@/components/site-detail/site-detail-shell";
import { getPublishedSiteBySlug } from "@/lib/site-repository";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublishedSiteBySlug(slug);
  if (!site) return {};
  return {
    title: `${site.title} · 设计规范`,
    description: site.summary,
  };
}

export default async function SiteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getPublishedSiteBySlug(slug);
  if (!site) notFound();
  return <SiteDetailShell site={site} />;
}
