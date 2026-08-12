import { getAuthorizedRemixDelivery } from "@/lib/remix-delivery";

export const maxDuration = 30;

function validSiteId(value: string) {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!validSiteId(siteId)) return Response.json({ error: "复刻产物不存在" }, { status: 404 });
  const result = await getAuthorizedRemixDelivery(siteId);
  if (!result.configured) return Response.json({ error: "复刻存储尚未配置" }, { status: 503 });
  if (!result.delivery) return Response.json({ error: "复刻产物不存在" }, { status: 404 });
  return Response.json(result.delivery.artifact, {
    headers: {
      "cache-control": result.scope === "public"
        ? "public, max-age=300, stale-while-revalidate=3600"
        : "private, no-store",
      etag: `"${result.delivery.artifact.delivery.bundleSha256}"`,
    },
  });
}
