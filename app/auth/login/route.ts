import { type NextRequest, NextResponse } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

/** After POST login, use 303 so the browser follows redirects with GET. */
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

function loginRedirectUrl(request: NextRequest, next?: string): URL {
  const loginUrl = new URL("/login", request.url);
  if (next?.startsWith("/")) {
    loginUrl.searchParams.set("next", next);
  }
  return loginUrl;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const { email, password, error: validationError } = readCredentials(formData);
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const loginUrl = loginRedirectUrl(request, next);
    loginUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(loginUrl, POST_AUTH_REDIRECT_STATUS);
  }

  return redirectResponse;
}
