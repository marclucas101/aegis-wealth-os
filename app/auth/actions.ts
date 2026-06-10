"use server";

/**
 * Auth forms POST to /auth/login and /auth/signup route handlers so Supabase
 * SSR cookies are written onto the redirect NextResponse (required on Vercel).
 */

export type AuthFormState = {
  error: string | null;
  success: string | null;
};
