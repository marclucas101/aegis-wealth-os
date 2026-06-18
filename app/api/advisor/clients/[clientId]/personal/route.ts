import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { updateClientDateOfBirth } from "@/lib/supabase/birthdayReminderTasks";
import { loadAdviserCalendarSettings } from "@/lib/supabase/calendarPersistence";
import {
  DEFAULT_ADVISER_TIMEZONE,
  parseDateOfBirth,
  referenceDateInTimezone,
  validateDateOfBirthForSave,
} from "@/src/lib/advisor/birthdayCalculation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

export type AdvisorClientPersonalResponse =
  | { ok: true; dateOfBirth: string | null }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "not_found" | "error";
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
  context: RouteContext,
): Promise<NextResponse<AdvisorClientPersonalResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason:
            access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
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
    const result = await resolveAccessibleClient(
      access.authUser.id,
      role,
      clientId,
    );

    if (result.status !== "ok") {
      return NextResponse.json(
        {
          ok: false,
          reason: result.status,
          error:
            result.status === "forbidden"
              ? "You do not have access to this client"
              : "Client not found",
        },
        { status: result.status === "forbidden" ? 403 : 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      dateOfBirth: result.client.date_of_birth,
    });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load client personal details",
    );
    console.error("[api/advisor/clients/[clientId]/personal GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorClientPersonalResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason:
            access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
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

    const rateLimit = rateLimitOrThrow<AdvisorClientPersonalResponse>(request, {
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

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: clientIdReject.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body);
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

    const body = parsed.body as Record<string, unknown>;
    const dateOfBirth = parseDateOfBirth(body.dateOfBirth);
    if (!dateOfBirth) {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Enter a valid date of birth" },
        { status: 400 },
      );
    }

    const { clientId } = await context.params;
    const clientAccess = await resolveAccessibleClient(
      access.authUser.id,
      role,
      clientId,
    );

    if (clientAccess.status !== "ok") {
      return NextResponse.json(
        {
          ok: false,
          reason: clientAccess.status,
          error:
            clientAccess.status === "forbidden"
              ? "You do not have access to this client"
              : "Client not found",
        },
        { status: clientAccess.status === "forbidden" ? 403 : 404 },
      );
    }

    const settings = await loadAdviserCalendarSettings(access.authUser.id);
    const timezone = settings.timezone || DEFAULT_ADVISER_TIMEZONE;
    const referenceDate = referenceDateInTimezone(timezone);
    const validation = validateDateOfBirthForSave(dateOfBirth, referenceDate);

    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: validation.error },
        { status: 400 },
      );
    }

    await updateClientDateOfBirth(
      clientId,
      validation.value,
      clientAccess.client.advisor_user_id ?? access.authUser.id,
      timezone,
    );

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId,
      userId: access.authUser.id,
      action: "client_date_of_birth_updated",
      entityType: "clients",
      entityId: clientId,
      metadata: {
        previous_date_of_birth: clientAccess.client.date_of_birth,
        new_date_of_birth: validation.value,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, dateOfBirth: validation.value });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to update client personal details",
    );
    console.error("[api/advisor/clients/[clientId]/personal PATCH]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
