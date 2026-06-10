import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  toPublicErrorMessage,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { rejectForbiddenIdentityFields } from "@/lib/supabase/adminManagement";
import {
  createPlaceholderClient,
  isValidEmail,
  type OnboardingClientRecord,
} from "@/lib/supabase/clientOnboarding";

export const dynamic = "force-dynamic";

export type AdvisorCreatePlaceholderResponse =
  | {
      ok: true;
      client: OnboardingClientRecord;
      linkedExistingUser: boolean;
    }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "invalid_input"
        | "duplicate_email"
        | "unsafe_link"
        | "error";
      error?: string;
    };

export async function POST(
  request: Request,
): Promise<NextResponse<AdvisorCreatePlaceholderResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Advisor access required",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
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

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, reason: "invalid_input", error: "Request body is required" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;

    if ("advisor_user_id" in body || "advisorUserId" in body) {
      return NextResponse.json(
        {
          ok: false,
          reason: "invalid_input",
          error: "advisor_user_id must not be supplied by the client",
        },
        { status: 400 },
      );
    }

    const displayNameResult = validateRequiredString(
      body.display_name ?? body.displayName,
      "display_name",
    );
    if (!displayNameResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "invalid_input", error: displayNameResult.error },
        { status: 400 },
      );
    }

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

    const phoneRaw = body.phone;
    const phone =
      typeof phoneRaw === "string" && phoneRaw.trim() ? phoneRaw.trim() : null;

    const result = await createPlaceholderClient({
      displayName: displayNameResult.value,
      email: emailResult.value,
      phone,
      advisorUserId: access.authUser.id,
    });

    if (!result.ok) {
      const status =
        result.reason === "duplicate_email"
          ? 409
          : result.reason === "unsafe_link"
            ? 400
            : 400;

      const reason =
        result.reason === "invalid_advisor" ? "error" : result.reason;

      return NextResponse.json(
        {
          ok: false,
          reason,
          error: result.message,
        },
        { status },
      );
    }

    const metadata = getRequestMetadata(request);

    await writeAuditLog({
      clientId: result.client.id,
      userId: access.authUser.id,
      action: "client_placeholder_created",
      entityType: "clients",
      entityId: result.client.id,
      metadata: {
        client_id: result.client.id,
        email: result.client.email,
        advisor_user_id: result.client.advisorUserId,
        linked_existing_user: result.linkedExistingUser,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({
      ok: true,
      client: result.client,
      linkedExistingUser: result.linkedExistingUser,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to create client placeholder");
    console.error("[api/advisor/clients/create-placeholder POST]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
