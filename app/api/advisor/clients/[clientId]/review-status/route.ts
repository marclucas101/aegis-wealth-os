import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadClientReviewStatus,
  MANUAL_REVIEW_STATUSES,
  updateClientReviewStatus,
  type ClientReviewStatusDetail,
  type ManualReviewStatus,
} from "@/lib/supabase/advisorReviewPipeline";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export type ClientReviewStatusGetResponse =
  | { ok: true; review: ClientReviewStatusDetail }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "not_found" | "error";
      error?: string;
    };

export type ClientReviewStatusPatchResponse =
  | {
      ok: true;
      clientId: string;
      oldStatus: string;
      newStatus: string;
    }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "error"
        | "no_change";
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
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ClientReviewStatusGetResponse>> {
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
    const result = await loadClientReviewStatus(
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

    return NextResponse.json({ ok: true, review: result.review });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load review status");
    console.error("[api/advisor/clients/[clientId]/review-status GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ClientReviewStatusPatchResponse>> {
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

    const rateLimit = rateLimitOrThrow<ClientReviewStatusPatchResponse>(request, {
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

    const unexpected = rejectUnexpectedFields(parsed.body);
    if (unexpected.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: unexpected.error },
        { status: 400 },
      );
    }

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: clientIdReject.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Request body is required" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const statusResult = validateEnum<ManualReviewStatus>(
      body.status,
      MANUAL_REVIEW_STATUSES,
      "status",
    );

    if (!statusResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: statusResult.error },
        { status: 400 },
      );
    }

    const { clientId } = await context.params;
    const result = await updateClientReviewStatus(
      access.authUser.id,
      role,
      clientId,
      statusResult.value,
    );

    if (!result.ok) {
      if (result.reason === "no_change") {
        return NextResponse.json(
          {
            ok: false,
            reason: "no_change",
            error: "Client status is already set to this value",
          },
          { status: 409 },
        );
      }

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

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: result.clientId,
      userId: access.authUser.id,
      action: "client_review_status_updated",
      entityType: "clients",
      entityId: result.clientId,
      metadata: {
        client_id: result.clientId,
        old_status: result.oldStatus,
        new_status: result.newStatus,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({
      ok: true,
      clientId: result.clientId,
      oldStatus: result.oldStatus,
      newStatus: result.newStatus,
    });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to update review status",
    );
    console.error("[api/advisor/clients/[clientId]/review-status PATCH]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
