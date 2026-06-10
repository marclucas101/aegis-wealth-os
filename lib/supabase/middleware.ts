import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseCookieOptions } from "./cookie-options";
import { getSupabasePublicEnv } from "./env";
import {
  normalizeSetCookieOptions,
  resolveFinalCookiesToSet,
} from "./set-cookie";
import type { Database } from "./types";

export type SessionUpdateResult = {
  response: NextResponse;
  user: User | null;
  applyCookies: (target: NextResponse) => NextResponse;
};

function getSupabaseCookieNames(request: NextRequest): string[] {
  return request.cookies
    .getAll()
    .map(({ name }) => name)
    .filter((name) => name.startsWith("sb-"));
}

/**
 * Copies refreshed Supabase auth cookies (with full options) onto redirect responses.
 */
export function applySessionCookies(
  source: SessionUpdateResult,
  target: NextResponse,
): NextResponse {
  return source.applyCookies(target);
}

/**
 * Refreshes the Supabase auth session and returns the verified user.
 * Call from root middleware on every matched request.
 */
export async function updateSession(
  request: NextRequest,
): Promise<SessionUpdateResult> {
  let response = NextResponse.next({ request });
  let pendingHeaders: Record<string, string> = {};
  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        headers: Record<string, string>,
      ) {
        const finalCookies = resolveFinalCookiesToSet(cookiesToSet);

        finalCookies.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        finalCookies.forEach(({ name, value, options }) => {
          response.cookies.set(
            name,
            value,
            normalizeSetCookieOptions(options),
          );
        });

        // Diagnostic: surface in the Network tab when the middleware clears
        // sb-* cookies (empty value or Max-Age=0), so a post-login wipe is
        // visible without inspecting cookie values.
        const clearedNames = finalCookies
          .filter(
            ({ name, value, options }) =>
              name.startsWith("sb-") && (!value || options.maxAge === 0),
          )
          .map(({ name }) => name);
        if (clearedNames.length > 0) {
          response.headers.set(
            "X-Aegis-Session-Cleared",
            clearedNames.join(","),
          );
        }

        pendingHeaders = { ...pendingHeaders, ...headers };
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (process.env.NODE_ENV === "development") {
    console.info("[middleware] session", {
      path: request.nextUrl.pathname,
      hasUser: Boolean(user),
      sbCookieNames: getSupabaseCookieNames(request),
    });
  }

  const applyCookies = (target: NextResponse): NextResponse => {
    const getSetCookie = response.headers.getSetCookie;
    if (typeof getSetCookie === "function") {
      for (const header of getSetCookie.call(response.headers)) {
        target.headers.append("Set-Cookie", header);
      }
    }

    Object.entries(pendingHeaders).forEach(([key, value]) => {
      target.headers.set(key, value);
    });

    return target;
  };

  return { response, user, applyCookies };
}
