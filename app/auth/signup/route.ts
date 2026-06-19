import { type NextRequest } from "next/server";

import { readAuthCredentials } from "@/lib/supabase/auth-credentials";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { hasSupabaseAuthCookiesOnHeaders } from "@/lib/supabase/set-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POST_AUTH_REDIRECT_STATUS = 303;

function redirectResponse(url: URL, headers: Headers): Response {
  headers.set("Location", url.toString());
  return new Response(null, { status: POST_AUTH_REDIRECT_STATUS, headers });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const { email, password, error: validationError } = readAuthCredentials(formData);

  if (validationError) {
    const signupUrl = new URL("/signup", request.url);
    signupUrl.searchParams.set("error", validationError);
    return redirectResponse(signupUrl, new Headers());
  }

  const responseHeaders = new Headers();
  const supabase = createRouteHandlerSupabaseClient(request, responseHeaders);
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const signupUrl = new URL("/signup", request.url);
    signupUrl.searchParams.set("error", error.message);
    return redirectResponse(signupUrl, new Headers());
  }

  if (data.session) {
    if (!hasSupabaseAuthCookiesOnHeaders(responseHeaders)) {
      const signupUrl = new URL("/signup", request.url);
      signupUrl.searchParams.set(
        "error",
        "Account created but session cookies were not saved. Please sign in.",
      );
      return redirectResponse(signupUrl, new Headers());
    }

    return redirectResponse(
      new URL("/auth/continue", request.url),
      responseHeaders,
    );
  }

  const signupUrl = new URL("/signup", request.url);
  signupUrl.searchParams.set(
    "success",
    "Account created. Check your email to confirm your address, then sign in.",
  );
  return redirectResponse(signupUrl, new Headers());
}
