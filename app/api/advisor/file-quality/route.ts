import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdvisorBookFileQuality,
  type AdvisorBookFileQuality,
} from "@/lib/supabase/clientFileQuality";

export const dynamic = "force-dynamic";

export type AdvisorBookFileQualityResponse =
  | ({ ok: true } & AdvisorBookFileQuality)
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

export async function GET(): Promise<
  NextResponse<AdvisorBookFileQualityResponse>
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

    const bookQuality = await loadAdvisorBookFileQuality(
      access.authUser.id,
      role,
    );

    return NextResponse.json({ ok: true, ...bookQuality });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load book file quality");
    console.error("[api/advisor/file-quality GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
