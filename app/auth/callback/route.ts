import { type NextRequest, NextResponse } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_auth_code", requestUrl.origin),
    );
  }

  const redirectPath = next.startsWith("/") ? next : "/dashboard";
  const redirectResponse = NextResponse.redirect(
    new URL(redirectPath, requestUrl.origin),
  );

  const supabase = createRouteHandlerSupabaseClient(request, redirectResponse);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[auth/callback] exchangeCodeForSession failed");
    }
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", requestUrl.origin),
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[auth/callback] session cookies set, redirecting");
  }

  return redirectResponse;
}
