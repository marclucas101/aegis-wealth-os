import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Optional overrides merged by @supabase/ssr with DEFAULT_COOKIE_OPTIONS
 * (path=/, sameSite=lax, httpOnly=false, maxAge=400d).
 *
 * Only add production Secure — do not replace Supabase defaults for path/sameSite.
 */
export function getSupabaseCookieOptions(): CookieOptionsWithName {
  if (process.env.NODE_ENV === "production") {
    return { secure: true };
  }

  return {};
}
