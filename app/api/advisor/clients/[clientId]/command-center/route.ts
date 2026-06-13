import { NextResponse } from "next/server";

import { rateLimitOrThrow, toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdvisorClientCommandCenterShell,
  type AdvisorClientCommandCenterShellPayload,
} from "@/lib/supabase/advisorClientCommandCenter";

export const dynamic = "force-dynamic";

export type AdvisorClientCommandCenterResponse =
  | ({ ok: true } & AdvisorClientCommandCenterShellPayload)
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "error";
      error?: string;
    };

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorClientCommandCenterResponse>> {
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

    const { clientId } = await context.params;

    const rateLimit = rateLimitOrThrow<AdvisorClientCommandCenterResponse>(request, {
      userId: access.authUser.id,
      bucket: "commandCenter",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const result = await loadAdvisorClientCommandCenterShell(
      access.authUser.id,
      role,
      clientId,
    );

    if (!result.ok) {
      if (result.reason === "forbidden") {
        return NextResponse.json(
          {
            ok: false,
            reason: "forbidden",
            error: "You do not have access to this client",
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          reason: "not_found",
          error: "Client not found",
        },
        { status: 404 },
      );
    }

    console.info(
      "[api/advisor/clients/[clientId]/command-center] timing",
      result.payload.timing,
    );

    return NextResponse.json({ ok: true, ...result.payload });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load client command center",
    );

    console.error("[api/advisor/clients/[clientId]/command-center]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
