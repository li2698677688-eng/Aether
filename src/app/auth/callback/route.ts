import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth-path";
import { createOptionalServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = request.nextUrl.searchParams.get("next");
  const safeNext = safeNextPath(nextPath);
  const supabase = await createOptionalServerClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const failureUrl = new URL("/login", request.url);
      failureUrl.searchParams.set("error", "callback");
      failureUrl.searchParams.set("next", safeNext);
      return NextResponse.redirect(failureUrl);
    }
  } else if (supabase && request.nextUrl.searchParams.has("error")) {
    const failureUrl = new URL("/login", request.url);
    failureUrl.searchParams.set("error", "callback");
    failureUrl.searchParams.set("next", safeNext);
    return NextResponse.redirect(failureUrl);
  }
  return NextResponse.redirect(new URL(safeNext, request.url));
}
