import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdvisorTaskSuggestions,
  type AdvisorTaskSuggestionsPayload,
} from "@/lib/supabase/advisorTaskSuggestions";

export const dynamic = "force-dynamic";

export type AdvisorTaskSuggestionsResponse =
  | ({ ok: true } & AdvisorTaskSuggestionsPayload & {
      viewer: { userId: string; role: "advisor" | "admin" };
    })
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
  NextResponse<AdvisorTaskSuggestionsResponse>
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
        { ok: false, reason: "forbidden", error: "Advisor access required" },
        { status: 403 },
      );
    }

    const payload = await loadAdvisorTaskSuggestions(access.authUser.id, role);

    return NextResponse.json({
      ok: true,
      ...payload,
      viewer: { userId: access.authUser.id, role },
    });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load task suggestions",
    );
    console.error("[api/advisor/task-suggestions GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
