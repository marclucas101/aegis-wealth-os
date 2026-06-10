import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  ensureUserClientProfile,
  type ClientStatus,
} from "@/lib/supabase/userProfile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export type MeResponse = {
  authenticated: boolean;
  hasUser: boolean;
  hasSession: boolean;
  cookieNames: string[];
  requestHost: string | null;
  requestProtocol: string | null;
  userId?: string;
  email?: string;
  clientId?: string;
  clientStatus?: ClientStatus;
};

function getSupabaseCookieNames(
  cookieList: { name: string; value: string }[],
): string[] {
  return cookieList
    .map(({ name }) => name)
    .filter((name) => name.startsWith("sb-"));
}

export async function GET(): Promise<NextResponse<MeResponse>> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieNames = getSupabaseCookieNames(cookieStore.getAll());
  const requestHost = headerStore.get("host");
  const requestProtocol = headerStore.get("x-forwarded-proto");

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const result = await ensureUserClientProfile();

    if (!result.authenticated) {
      return NextResponse.json(
        {
          authenticated: false,
          hasUser: Boolean(user),
          hasSession: Boolean(session),
          cookieNames,
          requestHost,
          requestProtocol,
        },
        { headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        hasUser: Boolean(user),
        hasSession: Boolean(session),
        cookieNames,
        requestHost,
        requestProtocol,
        userId: result.user.id,
        email: result.user.email,
        clientId: result.client.id,
        clientStatus: result.client.status,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to resolve user profile";

    console.error("[api/me]", message);

    return NextResponse.json(
      {
        authenticated: false,
        hasUser: false,
        hasSession: false,
        cookieNames,
        requestHost,
        requestProtocol,
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
