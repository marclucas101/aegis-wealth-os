import { type NextRequest, NextResponse } from "next/server";

import { readAuthCredentials } from "@/lib/supabase/auth-credentials";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import {
  describeSetCookieHeaders,
  hasSupabaseAuthCookiesOnResponse,
} from "@/lib/supabase/set-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POST_AUTH_REDIRECT_STATUS = 303;

function loginRedirectUrl(request: NextRequest, next?: string): URL {
  const loginUrl = new URL("/login", request.url);
  if (next?.startsWith("/")) {
    loginUrl.searchParams.set("next", next);
  }
  return loginUrl;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const { email, password, error: validationError } = readAuthCredentials(formData);
  const next = String(formData.get("next") ?? "").trim();

  if (validationError) {
    const loginUrl = loginRedirectUrl(request, next);
    loginUrl.searchParams.set("error", validationError);
    return NextResponse.redirect(loginUrl, POST_AUTH_REDIRECT_STATUS);
  }

  const redirectPath = next.startsWith("/") ? next : "/dashboard";
  const redirectResponse = NextResponse.redirect(
    new URL(redirectPath, request.url),
    POST_AUTH_REDIRECT_STATUS,
  );

  const supabase = createRouteHandlerSupabaseClient(request, redirectResponse);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  const setCookieHeaders =
    typeof redirectResponse.headers.getSetCookie === "function"
      ? redirectResponse.headers.getSetCookie()
      : [];

  console.info("[auth/login]", {
    host: new URL(request.url).host,
    origin: new URL(request.url).origin,
    hasUser: Boolean(data.user),
    hasSession: Boolean(data.session),
    setCookieCount: setCookieHeaders.length,
    cookieAttributes: describeSetCookieHeaders(setCookieHeaders),
  });

  if (error) {
    const loginUrl = loginRedirectUrl(request, next);
    loginUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(loginUrl, POST_AUTH_REDIRECT_STATUS);
  }

  if (!hasSupabaseAuthCookiesOnResponse(redirectResponse)) {
    const loginUrl = loginRedirectUrl(request, next);
    loginUrl.searchParams.set(
      "error",
      "Sign-in succeeded but session cookies were not saved. Please try again.",
    );
    return NextResponse.redirect(loginUrl, POST_AUTH_REDIRECT_STATUS);
  }

  return redirectResponse;
}
