import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import {
  ensureUserClientProfile,
  type AppClientRow,
  type AppUserRow,
} from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type ProfileCurrentResponse =
  | { ok: true; user: AppUserRow; client: AppClientRow }
  | { ok: false; error: string };

export async function GET(): Promise<NextResponse<ProfileCurrentResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      user: session.user,
      client: session.client,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load profile");

    console.error("[api/profile/current]", err);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
