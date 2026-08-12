import { createBrowserClient } from "@supabase/ssr";

import { isValidSupabaseRuntimeUrl } from "@/lib/runtime-health";

export function createOptionalBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey || !isValidSupabaseRuntimeUrl(url)) return null;
  return createBrowserClient(url, publishableKey);
}
