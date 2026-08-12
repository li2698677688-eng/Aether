import { checkRemixCompilerReachability, evaluateRuntimeHealth } from "@/lib/runtime-health";
import { createOptionalAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = evaluateRuntimeHealth(process.env);
  let databaseReachable = health.checks.data;
  const compilerReachable = health.checks.analysis
    ? await checkRemixCompilerReachability(process.env.REMIX_COMPILER_URL)
    : false;

  if (health.checks.data) {
    const client = createOptionalAdminClient();
    const result = client ? await client.from("categories").select("id").limit(1) : { error: new Error("client unavailable") };
    databaseReachable = !result.error;
  }

  const dependenciesReachable = health.mode === "demo" || (databaseReachable && compilerReachable);
  const status = health.status === "healthy" && dependenciesReachable ? "healthy" : "degraded";
  return Response.json(
    {
      status,
      mode: health.mode,
      checks: { ...health.checks, compilerReachable, databaseReachable },
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
      timestamp: new Date().toISOString(),
    },
    {
      headers: { "cache-control": "no-store" },
      status: status === "healthy" ? 200 : 503,
    },
  );
}
