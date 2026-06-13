import { NextResponse } from "next/server";

import type { MyAdviserPageData } from "@/lib/aegis/myAdviser";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { loadMyAdviserPageData } from "@/lib/supabase/adviserProfilePersistence";

export const dynamic = "force-dynamic";

export type MyAdviserResponse =
  | { ok: true; data: MyAdviserPageData }
  | { ok: false; reason: "unauthenticated" | "error"; error?: string };

export async function GET(): Promise<NextResponse<MyAdviserResponse>> {
  try {
    const result = await loadMyAdviserPageData();

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load adviser profile");
    console.error("[api/my-adviser GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
