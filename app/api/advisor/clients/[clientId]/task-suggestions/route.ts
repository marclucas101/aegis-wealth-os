import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadClientTaskSuggestions,
  type AdvisorTaskSuggestionsPayload,
} from "@/lib/supabase/advisorTaskSuggestions";

export const dynamic = "force-dynamic";

export type ClientTaskSuggestionsResponse =
  | ({ ok: true } & AdvisorTaskSuggestionsPayload & {
      viewer: { userId: string; role: "advisor" | "admin" };
    })
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "error";
      error?: string;
    };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
): Promise<NextResponse<ClientTaskSuggestionsResponse>> {
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

    const { clientId } = await context.params;
    const result = await loadClientTaskSuggestions(
      access.authUser.id,
      role,
      clientId,
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error:
            result.reason === "forbidden"
              ? "You do not have access to this client"
              : "Client not found",
        },
        { status: result.reason === "forbidden" ? 403 : 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      ...result.payload,
      viewer: { userId: access.authUser.id, role },
    });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load client task suggestions",
    );
    console.error("[api/advisor/clients/[clientId]/task-suggestions GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
