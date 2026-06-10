import { serializeCookieHeader } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { NextResponse } from "next/server";

export type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export type SetCookieDiagnostic = {
  name: string;
  path: string | null;
  secure: boolean;
  sameSite: string | null;
  maxAge: number | null;
  hasExpires: boolean;
  domainPresent: boolean;
  httpOnly: boolean;
  partitioned: boolean;
  priority: string | null;
  approximateValueLength: number;
  isClearingCookie: boolean;
  hasBase64Prefix: boolean;
  hasIllegalSetCookieChars: boolean;
  duplicateAttributeKeys: string[];
  serializedLength: number;
};

/**
 * Supabase may emit a Max-Age=0 clear and a fresh value for the same name in
 * one batch. Emit only the final operation per cookie name so Chrome does not
 * see a delete header for a cookie we are trying to store.
 */
export function resolveFinalCookiesToSet(
  cookiesToSet: CookieToSet[],
): CookieToSet[] {
  const byName = new Map<string, CookieToSet>();

  for (const cookie of cookiesToSet) {
    byName.set(cookie.name, cookie);
  }

  return Array.from(byName.values());
}

/**
 * Normalize options for browser-accepted host-only cookies on HTTPS.
 */
export function normalizeSetCookieOptions(
  options: CookieOptions,
): CookieOptions {
  const normalized: CookieOptions = { ...options };
  delete normalized.domain;

  normalized.path = "/";
  normalized.sameSite = "lax";

  if (normalized.maxAge !== undefined && normalized.maxAge > 0) {
    delete normalized.expires;
  }

  if (process.env.NODE_ENV === "production") {
    normalized.secure = true;
  }

  return normalized;
}

export function buildSetCookieHeader(
  name: string,
  value: string,
  options: CookieOptions,
): string {
  return serializeCookieHeader(name, value, normalizeSetCookieOptions(options));
}

function collectDuplicateAttributeKeys(header: string): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const segment of header.split(";").slice(1)) {
    const key = segment.trim().split("=")[0]?.toLowerCase();
    if (!key) continue;

    if (seen.has(key)) {
      duplicates.add(key);
    } else {
      seen.add(key);
    }
  }

  return Array.from(duplicates);
}

function valueHasIllegalSetCookieChars(value: string): boolean {
  return /[\r\n;]/.test(value);
}

export function analyzeSetCookieHeader(header: string): SetCookieDiagnostic {
  const segments = header.split(";").map((segment) => segment.trim());
  const name = segments[0]?.split("=")[0]?.trim() ?? "";
  const rawValue = segments[0]?.includes("=")
    ? segments[0]!.slice(segments[0]!.indexOf("=") + 1)
    : "";

  const diagnostic: SetCookieDiagnostic = {
    name,
    path: null,
    secure: false,
    sameSite: null,
    maxAge: null,
    hasExpires: false,
    domainPresent: false,
    httpOnly: false,
    partitioned: false,
    priority: null,
    approximateValueLength: rawValue.length,
    isClearingCookie: rawValue.length === 0,
    hasBase64Prefix: rawValue.startsWith("base64-"),
    hasIllegalSetCookieChars: valueHasIllegalSetCookieChars(rawValue),
    duplicateAttributeKeys: collectDuplicateAttributeKeys(header),
    serializedLength: header.length,
  };

  for (const segment of segments.slice(1)) {
    const lower = segment.toLowerCase();

    if (lower.startsWith("path=")) {
      diagnostic.path = segment.slice(5) || null;
    } else if (lower.startsWith("samesite=")) {
      diagnostic.sameSite = segment.slice(9);
    } else if (lower === "secure") {
      diagnostic.secure = true;
    } else if (lower === "httponly") {
      diagnostic.httpOnly = true;
    } else if (lower.startsWith("max-age=")) {
      diagnostic.maxAge = Number.parseInt(segment.slice(8), 10);
      if (Number.isNaN(diagnostic.maxAge)) {
        diagnostic.maxAge = null;
      }
    } else if (lower.startsWith("expires=")) {
      diagnostic.hasExpires = true;
    } else if (lower.startsWith("domain=")) {
      diagnostic.domainPresent = true;
    } else if (lower === "partitioned") {
      diagnostic.partitioned = true;
    } else if (lower.startsWith("priority=")) {
      diagnostic.priority = segment.slice(9);
    }
  }

  if (diagnostic.maxAge === 0) {
    diagnostic.isClearingCookie = true;
  }

  return diagnostic;
}

export function analyzeSetCookieHeaders(
  headers: string[],
): SetCookieDiagnostic[] {
  return headers.map(analyzeSetCookieHeader);
}

export function applySupabaseSetCookiesToHeaders(
  headers: Headers,
  cookiesToSet: CookieToSet[],
  responseHeaders?: Record<string, string>,
): string[] {
  const emitted: string[] = [];

  for (const cookie of resolveFinalCookiesToSet(cookiesToSet)) {
    const serialized = buildSetCookieHeader(
      cookie.name,
      cookie.value,
      cookie.options,
    );
    headers.append("Set-Cookie", serialized);
    emitted.push(serialized);
  }

  if (responseHeaders) {
    for (const [key, value] of Object.entries(responseHeaders)) {
      headers.set(key, value);
    }
  }

  return emitted;
}

export function applySupabaseSetCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[],
  responseHeaders?: Record<string, string>,
): string[] {
  return applySupabaseSetCookiesToHeaders(
    response.headers,
    cookiesToSet,
    responseHeaders,
  );
}

export function attachAuthCookieDiagnostics(
  headers: Headers,
  serializedHeaders: string[],
): void {
  const diagnostics = analyzeSetCookieHeaders(serializedHeaders);
  const sbDiagnostics = diagnostics.filter(({ name }) => name.startsWith("sb-"));

  headers.set("X-Aegis-Auth-Cookie-Count", String(sbDiagnostics.length));
  headers.set(
    "X-Aegis-Auth-Cookie-Names",
    sbDiagnostics.map(({ name }) => name).join(",") || "none",
  );
  headers.set(
    "X-Aegis-Auth-Cookie-Attrs",
    JSON.stringify(
      sbDiagnostics.map(
        ({
          name,
          path,
          secure,
          sameSite,
          maxAge,
          hasExpires,
          domainPresent,
          httpOnly,
          partitioned,
          priority,
          approximateValueLength,
          isClearingCookie,
          hasBase64Prefix,
          hasIllegalSetCookieChars,
          duplicateAttributeKeys,
          serializedLength,
        }) => ({
          name,
          path,
          secure,
          sameSite,
          maxAge,
          hasExpires,
          domainPresent,
          httpOnly,
          partitioned,
          priority,
          approximateValueLength,
          isClearingCookie,
          hasBase64Prefix,
          hasIllegalSetCookieChars,
          duplicateAttributeKeys,
          serializedLength,
        }),
      ),
    ),
  );
}

export function getSetCookieHeadersFrom(headers: Headers): string[] {
  const getSetCookie = headers.getSetCookie;
  return typeof getSetCookie === "function" ? getSetCookie.call(headers) : [];
}

export function hasSupabaseAuthCookiesOnHeaders(headers: Headers): boolean {
  return getSetCookieHeadersFrom(headers).some(isSupabaseAuthSetCookieHeader);
}

export function hasSupabaseAuthCookiesOnResponse(
  response: NextResponse,
): boolean {
  return hasSupabaseAuthCookiesOnHeaders(response.headers);
}

function isSupabaseAuthSetCookieHeader(header: string): boolean {
  const name = header.slice(0, header.indexOf("=")).trim();
  if (!name.startsWith("sb-")) {
    return false;
  }

  const value = header.slice(header.indexOf("=") + 1).split(";")[0]?.trim();
  return Boolean(value);
}
