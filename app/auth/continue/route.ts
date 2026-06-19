import { type NextRequest } from "next/server";

import { resolvePostAuthDestination } from "@/lib/compliance/postAuthRouting";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REDIRECT_STATUS = 303;

function redirectTo(url: URL, headers: Headers): Response {
  headers.set("Location", url.toString());
  return new Response(null, { status: REDIRECT_STATUS, headers });
}

/**
 * Server-resolved post-authentication landing route.
 * Reads session + client relationship stage; never trusts browser role/stage.
 */
export async function GET(request: NextRequest) {
  const responseHeaders = new Headers();
  const supabase = createRouteHandlerSupabaseClient(request, responseHeaders);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    const requestedNext = request.nextUrl.searchParams.get("next");
    if (requestedNext?.startsWith("/")) {
      loginUrl.searchParams.set("next", requestedNext);
    }
    return redirectTo(loginUrl, responseHeaders);
  }

  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "profile_unavailable");
    return redirectTo(loginUrl, responseHeaders);
  }

  const destination = resolvePostAuthDestination({
    user: session.user,
    client: session.client,
    requestedNext: request.nextUrl.searchParams.get("next"),
  });

  return redirectTo(new URL(destination, request.url), responseHeaders);
}
