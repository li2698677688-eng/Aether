type RuntimeEnvironment = Record<string, string | undefined>;

export type DesignAiConfig =
  | {
      provider: "openai";
      apiKey: string;
      model: string;
    }
  | {
      provider: "kimi";
      apiKey: string;
      baseURL: "https://api.moonshot.cn/v1" | "https://api.moonshot.ai/v1";
      model: string;
    };

const kimiApiBaseUrls = new Set([
  "https://api.moonshot.cn/v1",
  "https://api.moonshot.ai/v1",
]);

function normalizedModel(value: string | undefined, fallback: string) {
  const model = value?.trim() || fallback;
  return /^[a-zA-Z0-9._-]{1,100}$/.test(model) ? model : undefined;
}

function resolveKimiConfig(environment: RuntimeEnvironment): DesignAiConfig | undefined {
  const apiKey = environment.KIMI_API_KEY?.trim();
  const baseURL = (environment.KIMI_API_BASE_URL?.trim().replace(/\/+$/, "") || "https://api.moonshot.cn/v1");
  const model = normalizedModel(environment.KIMI_DESIGN_MODEL, "kimi-k3");
  if (!apiKey || !model || !kimiApiBaseUrls.has(baseURL)) return undefined;
  return {
    provider: "kimi",
    apiKey,
    baseURL: baseURL as Extract<DesignAiConfig, { provider: "kimi" }>["baseURL"],
    model,
  };
}

function resolveOpenAiConfig(environment: RuntimeEnvironment): DesignAiConfig | undefined {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  const model = normalizedModel(environment.OPENAI_DESIGN_MODEL, "gpt-5-mini-2025-08-07");
  if (!apiKey || !model) return undefined;
  return { provider: "openai", apiKey, model };
}

export function resolveDesignAiConfig(environment: RuntimeEnvironment): DesignAiConfig | undefined {
  const requestedProvider = environment.DESIGN_AI_PROVIDER?.trim().toLowerCase();
  if (requestedProvider === "kimi") return resolveKimiConfig(environment);
  if (requestedProvider === "openai") return resolveOpenAiConfig(environment);
  if (requestedProvider) return undefined;
  return resolveKimiConfig(environment) ?? resolveOpenAiConfig(environment);
}
