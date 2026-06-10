import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdvisorClientWorkspace,
  type AdvisorClientWorkspace,
} from "@/lib/supabase/advisorClientQueries";

export const dynamic = "force-dynamic";

export type AdvisorClientWorkspaceResponse =
  | ({ ok: true } & AdvisorClientWorkspace)
  | { ok: false; reason: "unauthenticated"; error?: string }
  | { ok: false; reason: "forbidden"; error?: string }
  | { ok: false; reason: "not_found"; error?: string }
  | { ok: false; reason: "error"; error: string };

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorClientWorkspaceResponse>> {
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

    const { clientId } = await context.params;

    const result = await loadAdvisorClientWorkspace(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
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

    return NextResponse.json({ ok: true, ...result.workspace });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load client workspace",
    );

    console.error("[api/advisor/clients/[clientId]]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
