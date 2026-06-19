import { type NextRequest } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { hasSupabaseAuthCookiesOnHeaders } from "@/lib/supabase/set-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH_REDIRECT_STATUS = 303;

function redirectResponse(url: URL, headers: Headers): Response {
  headers.set("Location", url.toString());
  return new Response(null, { status: AUTH_REDIRECT_STATUS, headers });
}

function safeCallbackNext(next: string | null): string | null {
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return null;
  }
  return next;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");

  if (!code) {
    return redirectResponse(
      new URL("/login?error=missing_auth_code", requestUrl.origin),
      new Headers(),
    );
  }

  const responseHeaders = new Headers();
  const supabase = createRouteHandlerSupabaseClient(request, responseHeaders);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[auth/callback] exchangeCodeForSession failed");
    }
    return redirectResponse(
      new URL("/login?error=auth_callback_failed", requestUrl.origin),
      new Headers(),
    );
  }

  if (!hasSupabaseAuthCookiesOnHeaders(responseHeaders)) {
    return redirectResponse(
      new URL("/login?error=auth_callback_failed", requestUrl.origin),
      new Headers(),
    );
  }

  const continueUrl = new URL("/auth/continue", requestUrl.origin);
  const safeNext = safeCallbackNext(rawNext);
  if (safeNext) {
    continueUrl.searchParams.set("next", safeNext);
  }

  return redirectResponse(continueUrl, responseHeaders);
}
