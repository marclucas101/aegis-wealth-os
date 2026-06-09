import { NextResponse } from "next/server";

import {
  ensureUserClientProfile,
  type ClientStatus,
} from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type MeResponse = {
  authenticated: boolean;
  userId?: string;
  email?: string;
  clientId?: string;
  clientStatus?: ClientStatus;
};

export async function GET(): Promise<NextResponse<MeResponse>> {
  try {
    const result = await ensureUserClientProfile();

    if (!result.authenticated) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
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
      { authenticated: false },
      { status: 500 },
    );
  }
}
