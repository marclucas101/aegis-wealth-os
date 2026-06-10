import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Shared Supabase auth cookie options for server and browser clients.
 * `secure` is required on HTTPS (Vercel production) and must stay off on local HTTP.
 */
export function getSupabaseCookieOptions(): CookieOptionsWithName {
  return {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
