import { NextResponse } from "next/server";

import { rateLimitOrThrow, toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdvisorCommandCenterHeavy,
  type AdvisorCommandCenterHeavyPayload,
} from "@/lib/supabase/advisorCommandCenter";

export const dynamic = "force-dynamic";

export type AdvisorCommandCenterHeavyResponse =
  | ({ ok: true } & AdvisorCommandCenterHeavyPayload)
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "error";
      error?: string;
    };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function GET(
  request: Request,
): Promise<NextResponse<AdvisorCommandCenterHeavyResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason:
            access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Advisor access required",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json(
        {
          ok: false,
          reason: "forbidden",
          error: "Advisor access required",
        },
        { status: 403 },
      );
    }

    const rateLimit = rateLimitOrThrow<AdvisorCommandCenterHeavyResponse>(
      request,
      {
        userId: access.authUser.id,
        bucket: "commandCenter",
      },
    );
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const payload = await loadAdvisorCommandCenterHeavy(
      access.authUser.id,
      role,
    );

    console.info("[api/advisor/command-center/heavy] timing", payload.timing);

    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load advisor command center panels",
    );

    console.error("[api/advisor/command-center/heavy]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
