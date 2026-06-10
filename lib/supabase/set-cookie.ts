import { serializeCookieHeader } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { NextResponse } from "next/server";

export type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export type CookieAttributeLog = {
  name: string;
  path?: string;
  sameSite?: CookieOptions["sameSite"];
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
  domain: string | null;
  hasExpires: boolean;
};

/**
 * Keep Supabase-provided options; only strip invalid overrides and enforce HTTPS.
 * Never set a custom Domain attribute.
 */
export function sanitizeSupabaseCookieOptions(
  options: CookieOptions,
): CookieOptions {
  const sanitized: CookieOptions = { ...options };
  delete sanitized.domain;

  if (process.env.NODE_ENV === "production") {
    sanitized.secure = true;
  }

  return sanitized;
}

export function describeCookieAttributes(
  cookiesToSet: CookieToSet[],
): CookieAttributeLog[] {
  return cookiesToSet.map(({ name, options }) => ({
    name,
    path: options.path,
    sameSite: options.sameSite,
    secure:
      process.env.NODE_ENV === "production" ? true : options.secure,
    httpOnly: options.httpOnly,
    maxAge: options.maxAge,
    domain: options.domain ?? null,
    hasExpires: options.expires !== undefined,
  }));
}

/**
 * Writes each Supabase cookie as its own Set-Cookie header so chunked auth
 * cookies and attributes are preserved (ResponseCookies.set can drop or
 * mis-serialize them on redirect responses).
 */
export function applySupabaseSetCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[],
  responseHeaders?: Record<string, string>,
): void {
  for (const { name, value, options } of cookiesToSet) {
    response.headers.append(
      "Set-Cookie",
      serializeCookieHeader(name, value, sanitizeSupabaseCookieOptions(options)),
    );
  }

  if (responseHeaders) {
    for (const [key, value] of Object.entries(responseHeaders)) {
      response.headers.set(key, value);
    }
  }
}

export function hasSupabaseAuthCookiesOnResponse(
  response: NextResponse,
): boolean {
  const getSetCookie = response.headers.getSetCookie;

  if (typeof getSetCookie === "function") {
    return getSetCookie
      .call(response.headers)
      .some((header) => isSupabaseAuthSetCookieHeader(header));
  }

  return response.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.value.length > 0);
}

function isSupabaseAuthSetCookieHeader(header: string): boolean {
  const name = header.slice(0, header.indexOf("=")).trim();
  if (!name.startsWith("sb-")) {
    return false;
  }

  const value = header.slice(header.indexOf("=") + 1).split(";")[0]?.trim();
  return Boolean(value);
}

/** Safe logging helper: names and attributes only, never cookie values. */
export function describeSetCookieHeaders(
  headers: string[],
): CookieAttributeLog[] {
  return headers
    .map((header) => {
      const segments = header.split(";").map((segment) => segment.trim());
      const name = segments[0]?.split("=")[0]?.trim() ?? "";
      const attributes: CookieAttributeLog = {
        name,
        domain: null,
        hasExpires: false,
      };

      for (const segment of segments.slice(1)) {
        const lower = segment.toLowerCase();

        if (lower.startsWith("path=")) {
          attributes.path = segment.slice(5);
        } else if (lower.startsWith("samesite=")) {
          attributes.sameSite = segment.slice(9).toLowerCase() as
            | "lax"
            | "strict"
            | "none";
        } else if (lower === "secure") {
          attributes.secure = true;
        } else if (lower === "httponly") {
          attributes.httpOnly = true;
        } else if (lower.startsWith("max-age=")) {
          attributes.maxAge = Number.parseInt(segment.slice(8), 10);
        } else if (lower.startsWith("expires=")) {
          attributes.hasExpires = true;
        } else if (lower.startsWith("domain=")) {
          attributes.domain = segment.slice(7) || null;
        }
      }

      return attributes;
    })
    .filter(({ name }) => name.startsWith("sb-"));
}
