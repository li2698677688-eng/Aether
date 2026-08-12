import { describe, expect, it } from "vitest";

import { checkRemixCompilerReachability, evaluateRuntimeHealth } from "@/lib/runtime-health";

const cloudEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_live_designfeed",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-live-designfeed",
  ANALYSIS_CALLBACK_SECRET: "callback-secret-with-at-least-32-characters",
  ANALYSIS_ENQUEUE_URL: "https://analyzer.designfeed.app/enqueue",
  ANALYSIS_ENQUEUE_SECRET: "enqueue-secret-with-at-least-32-characters",
  REMIX_COMPILER_URL: "https://compiler.designfeed.app",
  REMIX_COMPILER_API_KEY: "compiler-secret-with-at-least-32-characters",
  REMIX_COMPILER_REVISION: "3860a1a3a340069eabbfc550fd49807dd10f4f2c",
  OPENAI_API_KEY: "test-openai-api-key-that-is-not-secret",
  REMOVAL_CONTACT_EMAIL: "removal@designfeed.app",
};

describe("runtime health", () => {
  it("reports the compiler reachable only after a positive remote health response", async () => {
    const successfulFetch = async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://compiler.designfeed.app/healthz");
      return Response.json({ ok: true });
    };

    expect(await checkRemixCompilerReachability(
      "https://compiler.designfeed.app",
      successfulFetch as typeof fetch,
    )).toBe(true);
    expect(await checkRemixCompilerReachability(
      "https://compiler.designfeed.app",
      async () => Response.json({ ok: false }),
    )).toBe(false);
    expect(await checkRemixCompilerReachability(
      "https://compiler.designfeed.app",
      async () => { throw new Error("offline"); },
    )).toBe(false);
  });

  it("is healthy only when every production capability is configured", () => {
    expect(evaluateRuntimeHealth(cloudEnvironment, "production")).toEqual({
      mode: "cloud",
      status: "healthy",
      checks: { analysis: true, data: true, governance: true },
    });
  });

  it("accepts Kimi as the DesignSpec provider when OpenAI is not configured", () => {
    const environmentWithoutOpenAi = Object.fromEntries(
      Object.entries(cloudEnvironment).filter(([name]) => name !== "OPENAI_API_KEY"),
    );
    expect(evaluateRuntimeHealth({
      ...environmentWithoutOpenAi,
      KIMI_API_KEY: "test-kimi-api-key-that-is-not-secret",
    }, "production")).toEqual({
      mode: "cloud",
      status: "healthy",
      checks: { analysis: true, data: true, governance: true },
    });
  });

  it("fails closed in production without the analysis and governance configuration", () => {
    expect(evaluateRuntimeHealth({
      NEXT_PUBLIC_SUPABASE_URL: cloudEnvironment.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: cloudEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: cloudEnvironment.SUPABASE_SERVICE_ROLE_KEY,
    }, "production")).toEqual({
      mode: "cloud",
      status: "degraded",
      checks: { analysis: false, data: true, governance: false },
    });
  });

  it("identifies the dependency-free local demo without treating it as a broken cloud deployment", () => {
    expect(evaluateRuntimeHealth({}, "development")).toEqual({
      mode: "demo",
      status: "healthy",
      checks: { analysis: false, data: false, governance: false },
    });
  });

  it("fails closed when production endpoints still use placeholders or insecure origins", () => {
    expect(evaluateRuntimeHealth({
      ...cloudEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "https://project.example",
      ANALYSIS_ENQUEUE_URL: "http://analyzer.designfeed.app/enqueue",
    }, "production")).toEqual({
      mode: "cloud",
      status: "degraded",
      checks: { analysis: false, data: false, governance: true },
    });
  });

  it("rejects private production service endpoints", () => {
    expect(evaluateRuntimeHealth({
      ...cloudEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "https://127.0.0.1",
      ANALYSIS_ENQUEUE_URL: "https://[fd00::1]/enqueue",
    }, "production")).toMatchObject({
      status: "degraded",
      checks: { analysis: false, data: false },
    });
  });

  it("does not accept weak HMAC secrets or placeholder governance contacts", () => {
    expect(evaluateRuntimeHealth({
      ...cloudEnvironment,
      ANALYSIS_CALLBACK_SECRET: "short",
      REMOVAL_CONTACT_EMAIL: "removal@example.com",
    }, "production")).toEqual({
      mode: "cloud",
      status: "degraded",
      checks: { analysis: false, data: true, governance: false },
    });
  });

  it("allows explicit localhost endpoints during development", () => {
    expect(evaluateRuntimeHealth({
      ...cloudEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      ANALYSIS_ENQUEUE_URL: "http://localhost:8787/enqueue",
    }, "development")).toMatchObject({
      mode: "cloud",
      checks: { analysis: true, data: true, governance: true },
    });
  });
});
