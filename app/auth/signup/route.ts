import { type NextRequest, NextResponse } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

/** After POST signup, use 303 so the browser follows redirects with GET. */
const POST_AUTH_REDIRECT_STATUS = 303;

function readCredentials(formData: FormData): {
  email: string;
  password: string;
  error: string | null;
} {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { email, password, error: "Email and password are required." };
  }

  if (password.length < 8) {
    return {
      email,
      password,
      error: "Password must be at least 8 characters.",
    };
  }

  return { email, password, error: null };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const { email, password, error: validationError } = readCredentials(formData);

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
    return redirectResponse;
  }

  const signupUrl = new URL("/signup", request.url);
  signupUrl.searchParams.set(
    "success",
    "Account created. Check your email to confirm your address, then sign in.",
  );
  return NextResponse.redirect(signupUrl, POST_AUTH_REDIRECT_STATUS);
}
