import { isValidSupabaseRuntimeUrl } from "@/lib/runtime-health";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    && isValidSupabaseRuntimeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
  );
}

export function isGoogleAuthEnabled() {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
}
