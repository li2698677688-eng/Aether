import { z } from "zod";

import { featuredSites, getSiteBySlug } from "@/data/sites";
import { designSpecSchema, remixArtifactSchema } from "@/lib/contracts";
import { querySites, type SitePage, type SiteQuery } from "@/lib/site-query";
import { createOptionalPublicClient } from "@/lib/supabase/server";
import {
  siteCategories,
  type DesignSpec,
  type EmbedStatus,
  type RemixArtifact,
  type Site,
  type SiteCategory,
  type SiteStatus,
} from "@/types/site";

interface NamedRelation {
  name: string;
}

interface ProfileRelation {
  username: string | null;
  display_name: string | null;
}

export interface PublishedSiteRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  url: string;
  featured: boolean;
  created_at?: string;
  published_at: string | null;
  captured_at: string | null;
  screenshot_desktop: string | null;
  screenshot_mobile: string | null;
  embed_status: EmbedStatus;
  status: SiteStatus;
  design_spec: unknown;
  remix_artifact?: unknown;
  categories: NamedRelation | NamedRelation[] | null;
  site_tags: Array<{ tags: NamedRelation | NamedRelation[] | null }>;
  profiles: ProfileRelation | ProfileRelation[] | null;
}

const cursorSchema = z.object({
  featured: z.boolean(),
  publishedAt: z.string().datetime(),
  id: z.string().uuid(),
});

export type SiteCursor = z.infer<typeof cursorSchema>;

export const publicSiteSelect = [
  "id",
  "slug",
  "title",
  "summary",
  "url",
  "featured",
  "created_at",
  "published_at",
  "captured_at",
  "screenshot_desktop",
  "screenshot_mobile",
  "embed_status",
  "status",
  "design_spec",
  "remix_artifact",
  "categories!inner(name)",
  "site_tags(tags(name))",
  "profiles:profiles!sites_submitted_by_fkey(username,display_name)",
].join(",");

function firstRelation<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] : relation;
}

function parseDesignSpec(value: unknown): DesignSpec | undefined {
  const parsed = designSpecSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function parseRemixArtifact(value: unknown): RemixArtifact | undefined {
  const parsed = remixArtifactSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function readCategory(value: string | undefined): SiteCategory {
  return siteCategories.includes(value as SiteCategory) ? value as SiteCategory : "实验性网页";
}

function reviewedScreenshotUrl(siteId: string, variant: "desktop" | "mobile", value: string | null) {
  if (!value) return undefined;
  if (/^https?:\/\//.test(value) || value.startsWith("/")) return value;
  return `/api/screenshots/${encodeURIComponent(siteId)}/${variant}`;
}

export function mapPublishedSiteRow(row: PublishedSiteRow): Site {
  const category = firstRelation(row.categories);
  const profile = firstRelation(row.profiles);
  const username = profile?.username?.trim();
  const displayName = profile?.display_name?.trim();

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? "",
    url: row.url,
    category: readCategory(category?.name),
    tags: row.site_tags.flatMap(({ tags }) => {
      const tag = firstRelation(tags);
      return tag?.name ? [tag.name] : [];
    }),
    featured: row.featured,
    publishedAt: row.published_at ?? row.created_at ?? new Date(0).toISOString(),
    capturedAt: row.captured_at ?? undefined,
    cover: reviewedScreenshotUrl(row.id, "desktop", row.screenshot_desktop),
    mobileCover: reviewedScreenshotUrl(row.id, "mobile", row.screenshot_mobile),
    author: username ? `@${username}` : displayName || undefined,
    embedStatus: row.embed_status,
    status: row.status,
    designSpec: parseDesignSpec(row.design_spec),
    remixArtifact: parseRemixArtifact(row.remix_artifact),
  };
}

export function encodeSiteCursor(cursor: SiteCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeSiteCursor(value: string | null | undefined): SiteCursor | null {
  if (!value || value.length > 512) return null;
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

function normalizeSearch(value: string | undefined) {
  return value?.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 80) ?? "";
}

function cursorFilter(cursor: SiteCursor, sort: SiteQuery["sort"]) {
  const older = `published_at.lt.${cursor.publishedAt}`;
  const sameTimeLaterId = `and(published_at.eq.${cursor.publishedAt},id.gt.${cursor.id})`;
  if (sort === "latest") return `${older},${sameTimeLaterId}`;
  if (cursor.featured) {
    return `featured.eq.false,and(featured.eq.true,${older}),and(featured.eq.true,${sameTimeLaterId})`;
  }
  return `and(featured.eq.false,${older}),and(featured.eq.false,${sameTimeLaterId})`;
}

export async function getPublishedSitePage(query: SiteQuery = {}): Promise<SitePage> {
  const limit = Math.min(Math.max(query.limit ?? 12, 1), 24);
  const supabase = createOptionalPublicClient();
  if (!supabase) return querySites(featuredSites, { ...query, limit });

  let databaseQuery = supabase
    .from("sites")
    .select(publicSiteSelect)
    .eq("status", "published")
    .not("published_at", "is", null);

  if (query.category && query.category !== "全部") {
    databaseQuery = databaseQuery.eq("categories.name", query.category);
  }
  const search = normalizeSearch(query.q);
  if (search) databaseQuery = databaseQuery.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);

  const cursor = decodeSiteCursor(query.cursor);
  if (cursor) databaseQuery = databaseQuery.or(cursorFilter(cursor, query.sort));

  if (query.sort !== "latest") databaseQuery = databaseQuery.order("featured", { ascending: false });
  const { data, error } = await databaseQuery
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit + 1);

  if (error) throw new Error("PUBLIC_SITE_QUERY_FAILED", { cause: error });
  const rows = (data ?? []) as unknown as PublishedSiteRow[];
  const pageRows = rows.slice(0, limit);
  const items = pageRows.map(mapPublishedSiteRow);
  const last = pageRows.at(-1);

  return {
    items,
    nextCursor: rows.length > limit && last
      ? encodeSiteCursor({ featured: last.featured, publishedAt: last.published_at!, id: last.id })
      : null,
  };
}

export async function getPublishedSiteBySlug(slug: string) {
  const supabase = createOptionalPublicClient();
  if (!supabase) return getSiteBySlug(slug);
  const { data, error } = await supabase
    .from("sites")
    .select(publicSiteSelect)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("PUBLIC_SITE_DETAIL_FAILED", { cause: error });
  return data ? mapPublishedSiteRow(data as unknown as PublishedSiteRow) : undefined;
}
