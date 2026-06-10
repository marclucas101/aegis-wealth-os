import { type NextRequest, NextResponse } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { hasSupabaseAuthCookiesOnResponse } from "@/lib/supabase/set-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH_REDIRECT_STATUS = 303;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_auth_code", requestUrl.origin),
      AUTH_REDIRECT_STATUS,
    );
  }

  const redirectPath = next.startsWith("/") ? next : "/dashboard";
  const redirectResponse = NextResponse.redirect(
    new URL(redirectPath, requestUrl.origin),
    AUTH_REDIRECT_STATUS,
  );

  const supabase = createRouteHandlerSupabaseClient(request, redirectResponse);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[auth/callback] exchangeCodeForSession failed");
    }
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", requestUrl.origin),
      AUTH_REDIRECT_STATUS,
    );
  }

  if (!hasSupabaseAuthCookiesOnResponse(redirectResponse)) {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", requestUrl.origin),
      AUTH_REDIRECT_STATUS,
    );
  }

  return redirectResponse;
}
