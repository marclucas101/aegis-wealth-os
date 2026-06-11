import { NextResponse } from "next/server";

import type { AdviserContact } from "@/lib/aegis/adviserContact";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { loadAssignedAdviserContact } from "@/lib/supabase/adviserContactQueries";

export const dynamic = "force-dynamic";

export type AdviserContactResponse =
  | { ok: true; contact: AdviserContact }
  | { ok: false; error: string };

export async function GET(): Promise<NextResponse<AdviserContactResponse>> {
  try {
    const result = await loadAssignedAdviserContact();

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    return NextResponse.json({ ok: true, contact: result.contact });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load adviser contact");
    console.error("[api/adviser-contact GET]", err);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
