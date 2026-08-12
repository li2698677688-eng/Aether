import { remixArtifactSchema } from "@/lib/contracts";
import { getViewer } from "@/lib/auth";
import { createOptionalAdminClient } from "@/lib/supabase/server";
import type { RemixArtifact } from "@/types/site";

export interface RemixDeliveryRow {
  status: string;
  remix_artifact: unknown;
  remix_bundle_path: string | null;
  remix_evidence_path: string | null;
  remix_compiler_job_id: string | null;
}

export interface RemixDelivery {
  artifact: RemixArtifact;
  bundlePath: string;
  evidencePath: string;
  compilerJobId: string;
}

function scopedObjectPath(value: string | null, siteId: string) {
  if (!value || !value.startsWith(`${siteId}/`) || value.length > 512 || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value)) return false;
  return value.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

function parseRemixRow(row: RemixDeliveryRow, siteId: string, allowedStatuses: readonly string[]): RemixDelivery | null {
  if (!allowedStatuses.includes(row.status)) return null;
  const parsed = remixArtifactSchema.safeParse(row.remix_artifact);
  if (!parsed.success || parsed.data.reference.siteId !== siteId || parsed.data.quality.status !== "passed") return null;
  if (!scopedObjectPath(row.remix_bundle_path, siteId) || !scopedObjectPath(row.remix_evidence_path, siteId)) return null;
  if (!row.remix_compiler_job_id || !/^[a-zA-Z0-9_-]{1,128}$/.test(row.remix_compiler_job_id)) return null;
  return {
    artifact: parsed.data,
    bundlePath: row.remix_bundle_path!,
    evidencePath: row.remix_evidence_path!,
    compilerJobId: row.remix_compiler_job_id,
  };
}

export function parseDeliverableRemixRow(row: RemixDeliveryRow, siteId: string): RemixDelivery | null {
  return parseRemixRow(row, siteId, ["published"]);
}

export function parseReviewableRemixRow(row: RemixDeliveryRow, siteId: string): RemixDelivery | null {
  return parseRemixRow(row, siteId, ["in_review"]);
}

export async function getAuthorizedRemixDelivery(siteId: string) {
  const admin = createOptionalAdminClient();
  if (!admin) return { configured: false as const, delivery: null, scope: null };
  const { data, error } = await admin
    .from("sites")
    .select("status,remix_artifact,remix_bundle_path,remix_evidence_path,remix_compiler_job_id")
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw new Error("REMIX_DELIVERY_QUERY_FAILED", { cause: error });
  if (!data) return { configured: true as const, delivery: null, scope: null };

  const row = data as RemixDeliveryRow;
  const publicDelivery = parseDeliverableRemixRow(row, siteId);
  if (publicDelivery) return { configured: true as const, delivery: publicDelivery, scope: "public" as const };
  if (row.status !== "in_review") return { configured: true as const, delivery: null, scope: null };

  const viewer = await getViewer();
  if (viewer?.role !== "admin") return { configured: true as const, delivery: null, scope: null };
  const reviewDelivery = parseReviewableRemixRow(row, siteId);
  return {
    configured: true as const,
    delivery: reviewDelivery,
    scope: reviewDelivery ? "review" as const : null,
  };
}

export async function createPrivateRemixObjectUrl(path: string, downloadName?: string) {
  const admin = createOptionalAdminClient();
  if (!admin) return null;
  const bucket = process.env.SUPABASE_PRIVATE_REMIX_BUCKET ?? "remix_artifacts_private";
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(
    path,
    300,
    downloadName ? { download: downloadName } : undefined,
  );
  if (error) throw new Error("REMIX_OBJECT_SIGNING_FAILED", { cause: error });
  return data.signedUrl;
}
