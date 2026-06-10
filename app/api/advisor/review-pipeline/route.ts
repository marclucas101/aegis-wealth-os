import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdvisorReviewPipeline,
  type AdvisorReviewPipeline,
} from "@/lib/supabase/advisorReviewPipeline";

export const dynamic = "force-dynamic";

export type AdvisorReviewPipelineResponse =
  | ({ ok: true } & AdvisorReviewPipeline)
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function GET(): Promise<
  NextResponse<AdvisorReviewPipelineResponse>
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

    const pipeline = await loadAdvisorReviewPipeline(
      access.authUser.id,
      role,
    );

    return NextResponse.json({ ok: true, ...pipeline });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load review pipeline",
    );

    console.error("[api/advisor/review-pipeline]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
