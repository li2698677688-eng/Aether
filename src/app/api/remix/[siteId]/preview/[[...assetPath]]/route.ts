import { createRemixCompilerClient } from "@/lib/remix-compiler";
import { getAuthorizedRemixDelivery } from "@/lib/remix-delivery";
import { isStrongRuntimeSecret } from "@/lib/runtime-health";

export const maxDuration = 60;

export function remixPreviewSecurityHeaders(scope: "public" | "review", contentType?: string | null) {
  const headers = new Headers({
    "cache-control": scope === "public"
      ? "public, max-age=300, stale-while-revalidate=3600"
      : "private, no-store",
    // The compiler output is untrusted executable content. CSP sandbox without
    // allow-same-origin gives it an opaque origin even when opened directly.
    "content-security-policy": "sandbox allow-scripts; default-src 'none'; img-src data: blob: https:; font-src data: https:; media-src data: blob: https:; style-src 'unsafe-inline' https:; script-src 'self'; connect-src 'none'; frame-src 'none'; frame-ancestors 'self'; form-action 'none'; base-uri 'none'",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
  });
  if (contentType) headers.set("content-type", contentType);
  return headers;
}

export async function GET(_request: Request, { params }: { params: Promise<{ assetPath?: string[]; siteId: string }> }) {
  const { assetPath, siteId } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(siteId)) return new Response("Not found", { status: 404 });
  const result = await getAuthorizedRemixDelivery(siteId);
  if (!result.configured) return new Response("Remix preview is not configured", { status: 503 });
  if (!result.delivery || !result.scope) return new Response("Not found", { status: 404 });
  const baseUrl = process.env.REMIX_COMPILER_URL;
  const apiKey = process.env.REMIX_COMPILER_API_KEY;
  if (!baseUrl || !isStrongRuntimeSecret(apiKey)) return new Response("Remix preview is not configured", { status: 503 });
  const compiler = createRemixCompilerClient({ apiKey, baseUrl });
  const upstream = await compiler.preview(result.delivery.compilerJobId, assetPath?.join("/") ?? "");
  if (!upstream.ok || !upstream.body) return new Response("Preview unavailable", { status: upstream.status === 404 ? 404 : 502 });
  const headers = remixPreviewSecurityHeaders(result.scope, upstream.headers.get("content-type"));
  return new Response(upstream.body, { headers });
}
