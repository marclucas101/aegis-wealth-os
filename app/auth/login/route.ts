import { type NextRequest } from "next/server";

import { readAuthCredentials } from "@/lib/supabase/auth-credentials";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import {
  attachAuthCookieDiagnostics,
  getSetCookieHeadersFrom,
  hasSupabaseAuthCookiesOnHeaders,
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

function redirectResponse(
  url: URL,
  headers: Headers,
  status = POST_AUTH_REDIRECT_STATUS,
): Response {
  headers.set("Location", url.toString());
  return new Response(null, { status, headers });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const { email, password, error: validationError } = readAuthCredentials(formData);
  const next = String(formData.get("next") ?? "").trim();

  if (validationError) {
    return redirectResponse(loginRedirectUrl(request, next), new Headers());
  }

  const redirectPath = next.startsWith("/") ? next : "/dashboard";
  const responseHeaders = new Headers();
  const supabase = createRouteHandlerSupabaseClient(request, responseHeaders);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  const serializedSetCookies = getSetCookieHeadersFrom(responseHeaders);

  console.info("[auth/login]", {
    host: new URL(request.url).host,
    origin: new URL(request.url).origin,
    hasUser: Boolean(data.user),
    hasSession: Boolean(data.session),
    setCookieCount: serializedSetCookies.length,
  });

  if (error) {
    const loginUrl = loginRedirectUrl(request, next);
    loginUrl.searchParams.set("error", error.message);
    return redirectResponse(loginUrl, new Headers());
  }

  if (!hasSupabaseAuthCookiesOnHeaders(responseHeaders)) {
    const loginUrl = loginRedirectUrl(request, next);
    loginUrl.searchParams.set(
      "error",
      "Sign-in succeeded but session cookies were not saved. Please try again.",
    );
    return redirectResponse(loginUrl, new Headers());
  }

  attachAuthCookieDiagnostics(responseHeaders, serializedSetCookies);

  return redirectResponse(
    new URL(redirectPath, request.url),
    responseHeaders,
  );
}
