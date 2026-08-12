import { resolveDesignAiConfig } from "@/lib/design-ai";

type RuntimeEnvironment = Record<string, string | undefined>;

export interface RuntimeHealth {
  mode: "cloud" | "demo";
  status: "healthy" | "degraded";
  checks: {
    analysis: boolean;
    data: boolean;
    governance: boolean;
  };
}

function hasAll(environment: RuntimeEnvironment, names: string[]) {
  return names.every((name) => Boolean(environment[name]?.trim()));
}

function hasAny(environment: RuntimeEnvironment, names: string[]) {
  return names.some((name) => Boolean(environment[name]?.trim()));
}

function isPlaceholderHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "example.com"
    || normalized === "example.net"
    || normalized === "example.org"
    || normalized.endsWith(".example")
    || normalized.endsWith(".invalid")
    || normalized.endsWith(".test");
}

function isPrivateIpv4(value: string) {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19));
}

function isPrivateNetworkAddress(value: string) {
  const normalized = value.replace(/^\[|\]$/g, "").toLowerCase();
  return isPrivateIpv4(normalized)
    || normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("::ffff:")
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb")
    || normalized.startsWith("2001:db8:");
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "localhost"
    || isPrivateNetworkAddress(normalized)
    || normalized.endsWith(".local")
    || normalized.endsWith(".internal")
    || normalized.endsWith(".localhost");
}

function isRuntimeUrl(value: string | undefined, production: boolean, originOnly = false) {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (originOnly && (url.pathname !== "/" || url.search)) return false;
    if (production) {
      return url.protocol === "https:" && !isLocalHostname(url.hostname) && !isPlaceholderHostname(url.hostname);
    }
    return url.protocol === "https:" || (url.protocol === "http:" && isLocalHostname(url.hostname));
  } catch {
    return false;
  }
}

export function isStrongRuntimeSecret(value: string | undefined): value is string {
  return Boolean(value?.trim() && value.trim().length >= 32);
}

export async function checkRemixCompilerReachability(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  if (!baseUrl) return false;
  try {
    const response = await fetcher(new URL("/healthz", baseUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return false;
    const payload = await response.json() as { ok?: unknown };
    return payload.ok === true;
  } catch {
    return false;
  }
}

export function isValidSupabaseRuntimeUrl(
  value: string | undefined,
  nodeEnvironment: string | undefined = process.env.NODE_ENV,
): value is string {
  return isRuntimeUrl(value, nodeEnvironment === "production", true);
}

export function isAnalysisRuntimeConfigured(
  environment: RuntimeEnvironment,
  nodeEnvironment = environment.NODE_ENV,
) {
  const production = nodeEnvironment === "production";
  return Boolean(resolveDesignAiConfig(environment))
    && isRuntimeUrl(environment.ANALYSIS_ENQUEUE_URL, production)
    && isRuntimeUrl(environment.REMIX_COMPILER_URL, production, true)
    && isStrongRuntimeSecret(environment.ANALYSIS_CALLBACK_SECRET)
    && isStrongRuntimeSecret(environment.ANALYSIS_ENQUEUE_SECRET)
    && isStrongRuntimeSecret(environment.REMIX_COMPILER_API_KEY)
    && /^[a-f0-9]{40,64}$/i.test(environment.REMIX_COMPILER_REVISION ?? "");
}

function isGovernanceEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const hostname = email.slice(email.lastIndexOf("@") + 1);
  return !isLocalHostname(hostname) && !isPlaceholderHostname(hostname);
}

export function evaluateRuntimeHealth(environment: RuntimeEnvironment, nodeEnvironment = environment.NODE_ENV): RuntimeHealth {
  const production = nodeEnvironment === "production";
  const dataNames = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const data = hasAll(environment, dataNames)
    && isValidSupabaseRuntimeUrl(environment.NEXT_PUBLIC_SUPABASE_URL, nodeEnvironment);
  const analysis = isAnalysisRuntimeConfigured(environment, nodeEnvironment);
  const governance = isGovernanceEmail(environment.REMOVAL_CONTACT_EMAIL);
  const mode = hasAny(environment, dataNames) ? "cloud" : "demo";
  const complete = data && analysis && governance;

  return {
    mode,
    status: production && !complete ? "degraded" : "healthy",
    checks: { analysis, data, governance },
  };
}
