import { featuredSites } from "@/data/sites";
import type { Viewer } from "@/lib/auth";
import { listDemoJobs } from "@/lib/demo-jobs";
import type { DemoAnalysisJob } from "@/lib/demo-jobs";
import { isLocalDemoAllowed } from "@/lib/demo-runtime";
import { statusPresentation } from "@/lib/submission-status";
import {
  mapPublishedSiteRow,
  publicSiteSelect,
  type PublishedSiteRow,
} from "@/lib/site-repository";
import { createOptionalPublicClient, createOptionalServerClient } from "@/lib/supabase/server";
import type { Site, SiteCategory, SiteStatus } from "@/types/site";

export const reviewSiteSelect = publicSiteSelect.replace("categories!inner(name)", "categories(name)");

interface SubmissionSiteRelation {
  id: string;
  slug: string;
  title: string;
  url: string;
  submitted_by: string;
}

export interface SubmissionDatabaseRow {
  id: string;
  status: SiteStatus;
  attempts: number;
  error_code: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
  sites: SubmissionSiteRelation | SubmissionSiteRelation[];
}

export interface SubmissionItem {
  id: string;
  siteId: string;
  slug: string;
  title: string;
  url: string;
  status: SiteStatus;
  attempts: number;
  errorCode?: string;
  durationMs?: number;
  createdAt: string;
  updatedAt: string;
}

interface ReviewJobRelation {
  id: string;
  attempts: number;
  duration_ms: number | null;
  error_code: string | null;
  updated_at: string;
}

export interface ReviewDatabaseRow extends PublishedSiteRow {
  analysis_jobs: ReviewJobRelation[];
}

export interface ReviewItem {
  id: string;
  jobId: string;
  submittedBy: string;
  category: SiteCategory;
  attempts: number;
  durationMs?: number;
  errorCode?: string;
  artifactReviewed: boolean;
  designSpecEdited?: boolean;
  site: Site;
  demo?: boolean;
}

export interface PublicProfileData {
  username: string;
  displayName: string;
  avatarUrl?: string;
  sites: Site[];
}

function first<T>(relation: T | T[]) {
  return Array.isArray(relation) ? relation[0] : relation;
}

export function mapSubmissionRow(row: SubmissionDatabaseRow): SubmissionItem {
  const site = first(row.sites);
  return {
    id: row.id,
    siteId: site.id,
    slug: site.slug,
    title: site.title,
    url: site.url,
    status: row.status,
    attempts: row.attempts,
    errorCode: row.error_code ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { statusPresentation };

export function mapDemoSubmission(job: DemoAnalysisJob): SubmissionItem {
  return {
    id: job.id,
    siteId: `demo-site-${job.id}`,
    slug: `demo-${job.id}`,
    title: new URL(job.url).hostname,
    url: job.url,
    status: job.status,
    attempts: job.attempts,
    errorCode: job.errorCode,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function mapReviewRow(row: ReviewDatabaseRow): ReviewItem {
  const jobs = [...row.analysis_jobs].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const latestJob = jobs[0];
  const site = mapPublishedSiteRow(row);
  return {
    id: row.id,
    jobId: latestJob?.id ?? "",
    submittedBy: site.author ?? "匿名投稿",
    category: site.category,
    attempts: latestJob?.attempts ?? 0,
    durationMs: latestJob?.duration_ms ?? undefined,
    errorCode: latestJob?.error_code ?? undefined,
    artifactReviewed: false,
    site,
  };
}

const demoSubmissionStatuses: SiteStatus[] = ["in_review", "analyzing", "published"];

function demoSubmissions(): SubmissionItem[] {
  const submittedJobs = listDemoJobs().map(mapDemoSubmission);
  const examples = featuredSites.slice(0, 3).map((site, index) => ({
    id: `demo-job-${index + 1}`,
    siteId: site.id,
    slug: site.slug,
    title: site.title,
    url: site.url,
    status: demoSubmissionStatuses[index],
    attempts: 1,
    durationMs: index === 1 ? undefined : 42_000 + index * 6_000,
    createdAt: site.publishedAt,
    updatedAt: site.publishedAt,
  }));
  return [...submittedJobs, ...examples];
}

export async function getMySubmissions(viewer: Viewer): Promise<SubmissionItem[]> {
  if (viewer.demo) return demoSubmissions();
  const supabase = await createOptionalServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("analysis_jobs")
    .select("id,status,attempts,error_code,duration_ms,created_at,updated_at,sites!inner(id,slug,title,url,submitted_by)")
    .eq("sites.submitted_by", viewer.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("PRIVATE_SUBMISSION_QUERY_FAILED", { cause: error });
  return ((data ?? []) as unknown as SubmissionDatabaseRow[]).map(mapSubmissionRow);
}

export async function getFavoriteCollection(viewer: Viewer): Promise<{ sites: Site[]; initialIds: string[] }> {
  if (viewer.demo) return { sites: featuredSites, initialIds: [] };
  const supabase = await createOptionalServerClient();
  if (!supabase) return { sites: [], initialIds: [] };
  const { data, error } = await supabase
    .from("favorites")
    .select(`site_id,sites!inner(${publicSiteSelect})`)
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("PRIVATE_FAVORITE_QUERY_FAILED", { cause: error });
  const entries = (data ?? []) as unknown as Array<{ site_id: string; sites: PublishedSiteRow | PublishedSiteRow[] }>;
  return {
    initialIds: entries.map((entry) => entry.site_id),
    sites: entries.map((entry) => mapPublishedSiteRow(first(entry.sites))),
  };
}

export async function getPublicProfileData(username: string): Promise<PublicProfileData | undefined> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    if (!isLocalDemoAllowed() || username !== "designfeed") return undefined;
    return { username, displayName: "DesignFeed 设计师", sites: featuredSites.slice(0, 4) };
  }
  const supabase = createOptionalPublicClient();
  if (!supabase) return undefined;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .eq("username", username)
    .maybeSingle();
  if (profileError) throw new Error("PUBLIC_PROFILE_QUERY_FAILED", { cause: profileError });
  if (!profile) return undefined;
  const { data: rows, error: sitesError } = await supabase
    .from("sites")
    .select(publicSiteSelect)
    .eq("submitted_by", profile.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);
  if (sitesError) throw new Error("PUBLIC_PROFILE_SITE_QUERY_FAILED", { cause: sitesError });
  return {
    username: profile.username,
    displayName: profile.display_name || profile.username,
    avatarUrl: profile.avatar_url || undefined,
    sites: ((rows ?? []) as unknown as PublishedSiteRow[]).map(mapPublishedSiteRow),
  };
}

export async function getReviewQueue(viewer: Viewer): Promise<ReviewItem[]> {
  if (viewer.demo) {
    return featuredSites.slice(11, 14).map((site, index) => ({
      id: site.id,
      jobId: `demo-review-job-${index + 1}`,
      submittedBy: ["@lin", "@mia", "@bo"][index],
      category: site.category,
      attempts: index === 2 ? 2 : 1,
      durationMs: [48_000, 37_000, 71_000][index],
      errorCode: index === 2 ? "SCREENSHOT_UPLOAD_FAILED" : undefined,
      artifactReviewed: false,
      site: { ...site, status: index === 2 ? "failed" : "in_review" },
      demo: true,
    }));
  }
  const supabase = await createOptionalServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("sites")
    .select(`${reviewSiteSelect},analysis_jobs(id,attempts,duration_ms,error_code,updated_at)`)
    .in("status", ["in_review", "failed"])
    .order("updated_at", { ascending: true })
    .limit(50);
  if (error) throw new Error("ADMIN_REVIEW_QUERY_FAILED", { cause: error });
  return ((data ?? []) as unknown as ReviewDatabaseRow[]).map(mapReviewRow);
}
