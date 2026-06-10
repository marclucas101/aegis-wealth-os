import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  assignClientAdvisor,
  isValidUuid,
  rejectForbiddenIdentityFields,
  requireAdminAccess,
} from "@/lib/supabase/adminManagement";

export const dynamic = "force-dynamic";

export type AdminClientAdvisorResponse =
  | {
      ok: true;
      clientId: string;
      oldAdvisorUserId: string | null;
      newAdvisorUserId: string | null;
    }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "invalid_advisor"
        | "unchanged"
        | "error";
      error?: string;
    };

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

function parseAdvisorUserId(
  body: Record<string, unknown>,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = body.advisor_user_id ?? body.advisorUserId;

  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }

  if (typeof raw !== "string") {
    return { ok: false, error: "Missing or invalid advisor_user_id" };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (!isValidUuid(trimmed)) {
    return { ok: false, error: "Invalid advisor_user_id" };
  }

  return { ok: true, value: trimmed };
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdminClientAdvisorResponse>> {
  try {
    const access = await requireAdminAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Admin access required",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const { clientId } = await context.params;

    if (!isValidUuid(clientId)) {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Invalid client id" },
        { status: 400 },
      );
    }

    const rateLimit = rateLimitOrThrow<AdminClientAdvisorResponse>(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: parsed.error },
        { status: 400 },
      );
    }

    const forbidden = rejectForbiddenIdentityFields(parsed.body);
    if (forbidden.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: forbidden.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      rejectClientId: true,
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: sensitiveReject.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Request body is required" },
        { status: 400 },
      );
    }

    const advisorResult = parseAdvisorUserId(parsed.body as Record<string, unknown>);
    if (!advisorResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: advisorResult.error },
        { status: 400 },
      );
    }

    const result = await assignClientAdvisor(clientId, advisorResult.value);

    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "invalid_advisor"
            ? 400
            : result.reason === "unchanged"
              ? 409
              : 400;

      const errorMessages: Record<string, string> = {
        not_found: "Client not found",
        invalid_advisor: "Advisor must be a user with advisor or admin role",
        unchanged: "Advisor assignment is already set to this value",
      };

      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error: errorMessages[result.reason] ?? "Failed to assign advisor",
        },
        { status },
      );
    }

    const metadata = getRequestMetadata(request);
    const isUnassign = result.newAdvisorUserId === null;

    await writeAuditLog({
      clientId,
      userId: access.authUser.id,
      action: isUnassign ? "client_advisor_unassigned" : "client_advisor_assigned",
      entityType: "clients",
      entityId: clientId,
      metadata: {
        client_id: clientId,
        old_advisor_id: result.oldAdvisorUserId,
        new_advisor_id: result.newAdvisorUserId,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({
      ok: true,
      clientId: result.clientId,
      oldAdvisorUserId: result.oldAdvisorUserId,
      newAdvisorUserId: result.newAdvisorUserId,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to assign advisor");
    console.error("[api/admin/clients/[clientId]/advisor PATCH]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
