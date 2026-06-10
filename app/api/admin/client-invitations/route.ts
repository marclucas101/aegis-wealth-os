import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  rejectForbiddenIdentityFields,
  requireAdminAccess,
} from "@/lib/supabase/adminManagement";
import {
  inviteClientByEmail,
  isValidEmail,
  loadOnboardingClients,
  type InviteClientResult,
  type OnboardingClientRecord,
} from "@/lib/supabase/clientOnboarding";

export const dynamic = "force-dynamic";

export type AdminOnboardingListResponse =
  | { ok: true; clients: OnboardingClientRecord[] }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

export type AdminInviteClientResponse =
  | (InviteClientResult & { ok: true })
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "invalid_input"
        | "not_found"
        | "already_registered"
        | "error";
      error?: string;
    };

export async function GET(): Promise<NextResponse<AdminOnboardingListResponse>> {
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

    const clients = await loadOnboardingClients({ scope: "admin" });

    return NextResponse.json({ ok: true, clients });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load onboarding clients");
    console.error("[api/admin/client-invitations GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<AdminInviteClientResponse>> {
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

    const rateLimit = rateLimitOrThrow<AdminInviteClientResponse>(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, reason: "invalid_input", error: parsed.error },
        { status: 400 },
      );
    }

    const forbidden = rejectForbiddenIdentityFields(parsed.body);
    if (forbidden.rejected) {
      return NextResponse.json(
        { ok: false, reason: "invalid_input", error: forbidden.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body);
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, reason: "invalid_input", error: sensitiveReject.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, reason: "invalid_input", error: "Request body is required" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const emailResult = validateRequiredString(body.email, "email");
    if (!emailResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "invalid_input", error: emailResult.error },
        { status: 400 },
      );
    }

    if (!isValidEmail(emailResult.value)) {
      return NextResponse.json(
        { ok: false, reason: "invalid_input", error: "Valid email is required" },
        { status: 400 },
      );
    }

    const origin = new URL(request.url).origin;
    const result = await inviteClientByEmail({
      email: emailResult.value,
      actorUserId: access.authUser.id,
      scope: "admin",
      advisorUserId: access.authUser.id,
      redirectOrigin: origin,
    });

    const metadata = getRequestMetadata(request);

    if (!result.ok) {
      await writeAuditLog({
        userId: access.authUser.id,
        action: "client_invitation_failed",
        entityType: "clients",
        metadata: {
          email: emailResult.value,
          advisor_user_id: null,
          reason: result.reason,
        },
        ipAddress: metadata.ip_address,
        userAgent: metadata.user_agent,
      });

      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "already_registered"
            ? 409
            : 400;

      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error: result.message,
        },
        { status },
      );
    }

    await writeAuditLog({
      clientId: result.clientId,
      userId: access.authUser.id,
      action: "client_invitation_created",
      entityType: "clients",
      entityId: result.clientId,
      metadata: {
        client_id: result.clientId,
        email: result.email,
        advisor_user_id: result.advisorUserId,
        method: result.method,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to send client invitation");
    console.error("[api/admin/client-invitations POST]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
