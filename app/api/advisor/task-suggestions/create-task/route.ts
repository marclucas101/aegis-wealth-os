import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  toPublicErrorMessage,
  validateEnum,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  ADVISOR_TASK_PRIORITIES,
  isValidDateString,
  rejectForbiddenTaskFields as rejectTaskIdentityFields,
  type AdvisorTaskPriority,
  type AdvisorTaskRecord,
} from "@/lib/supabase/advisorTasks";
import {
  createTaskFromSuggestion,
  type AdvisorTaskSuggestion,
} from "@/lib/supabase/advisorTaskSuggestions";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CreateTaskFromSuggestionResponse =
  | { ok: true; task: AdvisorTaskRecord; suggestion: AdvisorTaskSuggestion }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "invalid_suggestion"
        | "error";
      error?: string;
    };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function parseClientId(
  body: Record<string, unknown>,
): { ok: true; clientId: string } | { ok: false; error: string } {
  const raw = body.client_id ?? body.clientId;

  if (typeof raw !== "string" || !isValidUuid(raw)) {
    return { ok: false, error: "Missing or invalid client_id" };
  }

  return { ok: true, clientId: raw };
}

function parseOptionalDueDate(
  body: Record<string, unknown>,
): { ok: true; dueDate: string | null | undefined } | { ok: false; error: string } {
  const raw = body.due_date ?? body.dueDate;

  if (raw === undefined) {
    return { ok: true, dueDate: undefined };
  }

  if (raw === null || raw === "") {
    return { ok: true, dueDate: null };
  }

  if (typeof raw !== "string" || !isValidDateString(raw)) {
    return { ok: false, error: "Missing or invalid due_date" };
  }

  return { ok: true, dueDate: raw };
}

function parseOptionalTitle(
  body: Record<string, unknown>,
): string | undefined {
  const raw = body.title;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

export async function POST(
  request: Request,
): Promise<NextResponse<CreateTaskFromSuggestionResponse>> {
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

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: parsed.error },
        { status: 400 },
      );
    }

    const forbidden = rejectTaskIdentityFields(parsed.body);
    if (forbidden.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: forbidden.error },
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

    const suggestionIdResult = validateRequiredString(
      body.suggestion_id ?? body.suggestionId,
      "suggestion_id",
    );
    if (!suggestionIdResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: suggestionIdResult.error },
        { status: 400 },
      );
    }

    const clientIdResult = parseClientId(body);
    if (!clientIdResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: clientIdResult.error },
        { status: 400 },
      );
    }

    const dueDateResult = parseOptionalDueDate(body);
    if (!dueDateResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: dueDateResult.error },
        { status: 400 },
      );
    }

    let priorityOverride: AdvisorTaskPriority | undefined;
    const priorityRaw = body.priority;
    if (priorityRaw !== undefined && priorityRaw !== null && priorityRaw !== "") {
      const priorityResult = validateEnum<AdvisorTaskPriority>(
        priorityRaw,
        ADVISOR_TASK_PRIORITIES,
        "priority",
      );
      if (!priorityResult.ok) {
        return NextResponse.json(
          { ok: false, reason: "error", error: priorityResult.error },
          { status: 400 },
        );
      }
      priorityOverride = priorityResult.value;
    }

    const result = await createTaskFromSuggestion(access.authUser.id, role, {
      suggestionId: suggestionIdResult.value,
      clientId: clientIdResult.clientId,
      titleOverride: parseOptionalTitle(body),
      dueDateOverride: dueDateResult.dueDate,
      priorityOverride,
    });

    if (!result.ok) {
      const status =
        result.reason === "forbidden"
          ? 403
          : result.reason === "not_found"
            ? 404
            : 400;

      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error:
            result.reason === "forbidden"
              ? "You do not have access to this client"
              : result.reason === "not_found"
                ? "Client not found"
                : "Suggestion is no longer valid or already addressed",
        },
        { status },
      );
    }

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: result.task.clientId,
      userId: access.authUser.id,
      action: "advisor_suggested_task_created",
      entityType: "advisor_tasks",
      entityId: result.task.id,
      metadata: {
        task_id: result.task.id,
        client_id: result.task.clientId,
        suggestion_type: result.suggestion.suggestion_type,
        priority: result.task.priority,
        due_date: result.task.dueDate,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json(
      {
        ok: true,
        task: result.task,
        suggestion: result.suggestion,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to create task from suggestion",
    );
    console.error("[api/advisor/task-suggestions/create-task POST]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
