import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ensureUserClientProfile,
  type ClientStatus,
} from "@/lib/supabase/userProfile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type MeResponse = {
  authenticated: boolean;
  hasUser: boolean;
  hasSession: boolean;
  cookieNames: string[];
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
  const cookieNames = getSupabaseCookieNames(cookieStore.getAll());

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
      return NextResponse.json({
        authenticated: false,
        hasUser: Boolean(user),
        hasSession: Boolean(session),
        cookieNames,
      });
    }

    return NextResponse.json({
      authenticated: true,
      hasUser: Boolean(user),
      hasSession: Boolean(session),
      cookieNames,
      userId: result.user.id,
      email: result.user.email,
      clientId: result.client.id,
      clientStatus: result.client.status,
    });
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
      },
      { status: 500 },
    );
  }
}
