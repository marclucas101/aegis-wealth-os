import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdvisorNotifications,
  type AdvisorNotificationsPayload,
} from "@/lib/supabase/advisorNotifications";

export const dynamic = "force-dynamic";

export type AdvisorNotificationsResponse =
  | ({ ok: true } & AdvisorNotificationsPayload)
  | { ok: false; reason: "unauthenticated"; error?: string }
  | { ok: false; reason: "forbidden"; error?: string }
  | { ok: false; reason: "error"; error: string };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function GET(): Promise<NextResponse<AdvisorNotificationsResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      if (access.reason === "unauthenticated") {
        return NextResponse.json(
          { ok: false, reason: "unauthenticated" },
          { status: 401 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          reason: "forbidden",
          error: "Advisor access required",
        },
        { status: 403 },
      );
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "forbidden", error: "Advisor access required" },
        { status: 403 },
      );
    }

    const payload = await loadAdvisorNotifications(access.authUser.id, role);

    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load advisor notifications",
    );

    console.error("[api/advisor/notifications]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
