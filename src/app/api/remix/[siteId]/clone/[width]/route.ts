import { createPrivateRemixObjectUrl, getAuthorizedRemixDelivery } from "@/lib/remix-delivery";

export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; width: string }> }) {
  const { siteId, width: widthValue } = await params;
  const width = Number(widthValue);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(siteId) || !Number.isInteger(width)) {
    return Response.json({ error: "复刻结果截图不存在" }, { status: 404 });
  }
  const result = await getAuthorizedRemixDelivery(siteId);
  if (!result.configured) return Response.json({ error: "复刻存储尚未配置" }, { status: 503 });
  const screenshot = result.delivery?.artifact.evidence.cloneScreenshots.find((item) => item.width === width);
  if (!result.delivery || !screenshot) return Response.json({ error: "复刻结果截图不存在" }, { status: 404 });
  const prefix = result.delivery.evidencePath.slice(0, result.delivery.evidencePath.lastIndexOf("/") + 1);
  const signedUrl = await createPrivateRemixObjectUrl(`${prefix}clone-${width}.webp`);
  if (!signedUrl) return Response.json({ error: "复刻存储尚未配置" }, { status: 503 });
  return Response.redirect(signedUrl, 307);
}
