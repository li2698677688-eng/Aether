import { z } from "zod";

import { resolveDesignAiConfig } from "@/lib/design-ai";
import { generateDesignSpec } from "@/lib/design-ai-client";
import { isStrongRuntimeSecret } from "@/lib/runtime-health";

export const maxDuration = 60;

const requestSchema = z.object({
  jobId: z.string().min(1).max(128),
  url: z.string().url(),
  extraction: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const expected = process.env.ANALYSIS_ENQUEUE_SECRET;
  const authorization = request.headers.get("authorization");
  if (!isStrongRuntimeSecret(expected)) return Response.json({ error: "服务尚未安全配置" }, { status: 503 });
  if (authorization !== `Bearer ${expected}`) return Response.json({ error: "未授权" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return Response.json({ error: "分析输入过大" }, { status: 413 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "分析输入不符合契约" }, { status: 400 });
  if (JSON.stringify(parsed.data.extraction).length > 500_000) return Response.json({ error: "页面证据超过分析上限" }, { status: 413 });
  const config = resolveDesignAiConfig(process.env);
  if (!config) return Response.json({ error: "设计分析模型未配置" }, { status: 503 });
  const result = await generateDesignSpec(config, parsed.data);
  if (!result) return Response.json({ error: "模型未返回可用设计规范" }, { status: 502 });
  return Response.json(result);
}
