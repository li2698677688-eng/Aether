import { describe, expect, it } from "vitest";

import { resolveDesignAiConfig } from "@/lib/design-ai";

describe("design AI configuration", () => {
  it("uses the Kimi China API defaults when only a Kimi key is configured", () => {
    expect(resolveDesignAiConfig({
      KIMI_API_KEY: "test-kimi-api-key-that-is-not-secret",
    })).toEqual({
      provider: "kimi",
      apiKey: "test-kimi-api-key-that-is-not-secret",
      baseURL: "https://api.moonshot.cn/v1",
      model: "kimi-k3",
    });
  });

  it("accepts the official global Kimi API endpoint", () => {
    expect(resolveDesignAiConfig({
      KIMI_API_KEY: "test-kimi-api-key-that-is-not-secret",
      KIMI_API_BASE_URL: "https://api.moonshot.ai/v1",
      KIMI_DESIGN_MODEL: "kimi-k2.6",
    })).toEqual({
      provider: "kimi",
      apiKey: "test-kimi-api-key-that-is-not-secret",
      baseURL: "https://api.moonshot.ai/v1",
      model: "kimi-k2.6",
    });
  });

  it("rejects a custom Kimi endpoint so the API key cannot be exfiltrated", () => {
    expect(resolveDesignAiConfig({
      KIMI_API_KEY: "test-kimi-api-key-that-is-not-secret",
      KIMI_API_BASE_URL: "https://attacker.example/v1",
    })).toBeUndefined();
  });

  it("preserves the existing OpenAI configuration", () => {
    expect(resolveDesignAiConfig({
      OPENAI_API_KEY: "test-openai-api-key-that-is-not-secret",
      OPENAI_DESIGN_MODEL: "gpt-5-mini-2025-08-07",
    })).toEqual({
      provider: "openai",
      apiKey: "test-openai-api-key-that-is-not-secret",
      model: "gpt-5-mini-2025-08-07",
    });
  });
});
