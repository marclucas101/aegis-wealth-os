import { type NextRequest } from "next/server";

import { readAuthCredentials } from "@/lib/supabase/auth-credentials";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import {
  attachAuthCookieDiagnostics,
  buildSetCookieHeader,
  getSetCookieHeadersFrom,
  hasSupabaseAuthCookiesOnHeaders,
} from "@/lib/supabase/set-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POST_AUTH_REDIRECT_STATUS = 303;

const PROBE_COOKIE_NAME = "aegis-cookie-probe";

function withStage(headers: Headers, stage: string): Headers {
  headers.set("X-Aegis-Auth-Route", "login");
  headers.set("X-Aegis-Auth-Stage", stage);
  return headers;
}

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

function buildContinueUrl(request: NextRequest, next: string): URL {
  const continueUrl = new URL("/auth/continue", request.url);
  if (next.startsWith("/")) {
    continueUrl.searchParams.set("next", next);
  }
  return continueUrl;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const { email, password, error: validationError } = readAuthCredentials(formData);
  const next = String(formData.get("next") ?? "").trim();

  if (validationError) {
    return redirectResponse(
      loginRedirectUrl(request, next),
      withStage(new Headers(), "invalid-input"),
    );
  }

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
    return redirectResponse(loginUrl, withStage(new Headers(), "signin-error"));
  }

  if (!hasSupabaseAuthCookiesOnHeaders(responseHeaders)) {
    const loginUrl = loginRedirectUrl(request, next);
    loginUrl.searchParams.set(
      "error",
      "Sign-in succeeded but session cookies were not saved. Please try again.",
    );
    return redirectResponse(
      loginUrl,
      withStage(new Headers(), "no-session-cookies"),
    );
  }

  attachAuthCookieDiagnostics(responseHeaders, serializedSetCookies);
  withStage(responseHeaders, "success");
  responseHeaders.append(
    "Set-Cookie",
    buildSetCookieHeader(PROBE_COOKIE_NAME, "1", { maxAge: 3600 }),
  );

  return redirectResponse(
    buildContinueUrl(request, next),
    responseHeaders,
  );
}
