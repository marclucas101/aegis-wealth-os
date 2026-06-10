"use server";

/**
 * Legacy server-action auth entry points.
 * Login and signup forms POST to /auth/login and /auth/signup route handlers
 * so Supabase SSR cookies are written onto the redirect response on Vercel.
 */

export type AuthFormState = {
  error: string | null;
  success: string | null;
};
