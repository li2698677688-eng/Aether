import { createPrivateRemixObjectUrl, getAuthorizedRemixDelivery } from "@/lib/remix-delivery";

export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(siteId)) return Response.json({ error: "复刻证据不存在" }, { status: 404 });
  const result = await getAuthorizedRemixDelivery(siteId);
  if (!result.configured) return Response.json({ error: "复刻存储尚未配置" }, { status: 503 });
  if (!result.delivery) return Response.json({ error: "复刻证据不存在" }, { status: 404 });
  const signedUrl = await createPrivateRemixObjectUrl(result.delivery.evidencePath);
  if (!signedUrl) return Response.json({ error: "复刻存储尚未配置" }, { status: 503 });
  return Response.redirect(signedUrl, 307);
}
