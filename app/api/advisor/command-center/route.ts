import { NextResponse } from "next/server";

import { rateLimitOrThrow, toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdvisorCommandCenter,
  type AdvisorCommandCenterPayload,
} from "@/lib/supabase/advisorCommandCenter";

export const dynamic = "force-dynamic";

export type AdvisorCommandCenterResponse =
  | ({ ok: true } & AdvisorCommandCenterPayload)
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
): Promise<
  NextResponse<AdvisorCommandCenterResponse>
> {
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

    const rateLimit = rateLimitOrThrow<AdvisorCommandCenterResponse>(request, {
      userId: access.authUser.id,
      bucket: "commandCenter",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const payload = await loadAdvisorCommandCenter(access.authUser.id, role);

    // Lightweight server-side timing for future profiling (stripped from client in production if needed).
    console.info("[api/advisor/command-center] timing", payload.timing);

    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load advisor command center",
    );

    console.error("[api/advisor/command-center]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
