import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

export type AuthCookiesDebugResponse = {
  requestHost: string | null;
  requestProtocol: string | null;
  incomingCookieNames: string[];
  incomingCookieCount: number;
  incomingRawCookieHeaderPresent: boolean;
  incomingRawCookieHeaderContainsProjectRef: boolean;
  basicCookiePresent: boolean;
  bigCookiePresent: boolean;
  sbNamedCookiePresent: boolean;
  probeCookiePresent: boolean;
  supabaseAuthCookiePresent: boolean;
  environment: string | null;
  production: boolean;
};

export async function GET(): Promise<NextResponse<AuthCookiesDebugResponse>> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const incomingCookieNames = cookieStore.getAll().map(({ name }) => name);
  const rawCookieHeader = headerStore.get("cookie");
  const projectRef = getSupabaseProjectRef();

  return NextResponse.json(
    {
      requestHost: headerStore.get("host"),
      requestProtocol: headerStore.get("x-forwarded-proto"),
      incomingCookieNames,
      incomingCookieCount: incomingCookieNames.length,
      incomingRawCookieHeaderPresent: Boolean(rawCookieHeader),
      incomingRawCookieHeaderContainsProjectRef: projectRef
        ? rawCookieHeader?.includes(projectRef) ?? false
        : false,
      basicCookiePresent: incomingCookieNames.includes("aegis-basic-cookie"),
      bigCookiePresent: incomingCookieNames.includes("aegis-big-cookie"),
      sbNamedCookiePresent: incomingCookieNames.includes("sb-size-probe"),
      probeCookiePresent: incomingCookieNames.includes("aegis-cookie-probe"),
      supabaseAuthCookiePresent: projectRef
        ? incomingCookieNames.some((name) =>
            name.startsWith(`sb-${projectRef}-auth-token`),
          )
        : false,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      production: process.env.NODE_ENV === "production",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
