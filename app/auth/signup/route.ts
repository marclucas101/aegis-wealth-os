import { type NextRequest, NextResponse } from "next/server";

import { readAuthCredentials } from "@/lib/supabase/auth-credentials";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { hasSupabaseAuthCookiesOnResponse } from "@/lib/supabase/set-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POST_AUTH_REDIRECT_STATUS = 303;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const { email, password, error: validationError } = readAuthCredentials(formData);

  if (validationError) {
    const signupUrl = new URL("/signup", request.url);
    signupUrl.searchParams.set("error", validationError);
    return NextResponse.redirect(signupUrl, POST_AUTH_REDIRECT_STATUS);
  }

  const redirectResponse = NextResponse.redirect(
    new URL("/dashboard", request.url),
    POST_AUTH_REDIRECT_STATUS,
  );

  const supabase = createRouteHandlerSupabaseClient(request, redirectResponse);
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const signupUrl = new URL("/signup", request.url);
    signupUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(signupUrl, POST_AUTH_REDIRECT_STATUS);
  }

  if (data.session) {
    if (!hasSupabaseAuthCookiesOnResponse(redirectResponse)) {
      const signupUrl = new URL("/signup", request.url);
      signupUrl.searchParams.set(
        "error",
        "Account created but session cookies were not saved. Please sign in.",
      );
      return NextResponse.redirect(signupUrl, POST_AUTH_REDIRECT_STATUS);
    }

    return redirectResponse;
  }

  const signupUrl = new URL("/signup", request.url);
  signupUrl.searchParams.set(
    "success",
    "Account created. Check your email to confirm your address, then sign in.",
  );
  return NextResponse.redirect(signupUrl, POST_AUTH_REDIRECT_STATUS);
}
