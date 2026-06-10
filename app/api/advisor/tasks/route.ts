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
  ADVISOR_TASK_TYPES,
  createAdvisorTask,
  isValidDateString,
  loadAdvisorTaskDashboard,
  rejectForbiddenTaskFields,
  type AdvisorTaskDashboard,
  type AdvisorTaskPriority,
  type AdvisorTaskRecord,
  type AdvisorTaskType,
} from "@/lib/supabase/advisorTasks";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdvisorTasksDashboardResponse =
  | ({ ok: true } & AdvisorTaskDashboard & {
      viewer: { userId: string; role: "advisor" | "admin" };
    })
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "error";
      error?: string;
    };

export type AdvisorTasksCreateResponse =
  | { ok: true; task: AdvisorTaskRecord }
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

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function parseOptionalClientId(
  body: Record<string, unknown>,
): { ok: true; clientId: string | null } | { ok: false; error: string } {
  const raw = body.client_id ?? body.clientId;

  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, clientId: null };
  }

  if (typeof raw !== "string" || !isValidUuid(raw)) {
    return { ok: false, error: "Missing or invalid client_id" };
  }

  return { ok: true, clientId: raw };
}

function parseOptionalDueDate(
  body: Record<string, unknown>,
): { ok: true; dueDate: string | null } | { ok: false; error: string } {
  const raw = body.due_date ?? body.dueDate;

  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, dueDate: null };
  }

  if (typeof raw !== "string" || !isValidDateString(raw)) {
    return { ok: false, error: "Missing or invalid due_date" };
  }

  return { ok: true, dueDate: raw };
}

function parseOptionalDescription(
  body: Record<string, unknown>,
): { ok: true; description: string | null } | { ok: false; error: string } {
  const raw = body.description;

  if (raw === undefined || raw === null) {
    return { ok: true, description: null };
  }

  if (typeof raw !== "string") {
    return { ok: false, error: "Missing or invalid description" };
  }

  return { ok: true, description: raw.trim() || null };
}

function parseAssignedToUserId(
  body: Record<string, unknown>,
  authUserId: string,
  role: "advisor" | "admin",
): { ok: true; assignedToUserId: string } | { ok: false; error: string } {
  const raw = body.assigned_to_user_id ?? body.assignedToUserId;

  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, assignedToUserId: authUserId };
  }

  if (role === "advisor") {
    return {
      ok: false,
      error: "assigned_to_user_id must not be supplied by advisors",
    };
  }

  if (typeof raw !== "string" || !isValidUuid(raw)) {
    return { ok: false, error: "Missing or invalid assigned_to_user_id" };
  }

  return { ok: true, assignedToUserId: raw };
}

function parseRelatedEntity(
  body: Record<string, unknown>,
):
  | { ok: true; relatedEntityType: string | null; relatedEntityId: string | null }
  | { ok: false; error: string } {
  const typeRaw = body.related_entity_type ?? body.relatedEntityType;
  const idRaw = body.related_entity_id ?? body.relatedEntityId;

  let relatedEntityType: string | null = null;
  let relatedEntityId: string | null = null;

  if (typeRaw !== undefined && typeRaw !== null && typeRaw !== "") {
    if (typeof typeRaw !== "string" || !typeRaw.trim()) {
      return { ok: false, error: "Missing or invalid related_entity_type" };
    }

    relatedEntityType = typeRaw.trim();
  }

  if (idRaw !== undefined && idRaw !== null && idRaw !== "") {
    if (typeof idRaw !== "string" || !isValidUuid(idRaw)) {
      return { ok: false, error: "Missing or invalid related_entity_id" };
    }

    relatedEntityId = idRaw;
  }

  return { ok: true, relatedEntityType, relatedEntityId };
}

export async function GET(): Promise<
  NextResponse<AdvisorTasksDashboardResponse>
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

    const dashboard = await loadAdvisorTaskDashboard(
      access.authUser.id,
      role,
    );

    return NextResponse.json({
      ok: true,
      ...dashboard,
      viewer: { userId: access.authUser.id, role },
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load advisor tasks");
    console.error("[api/advisor/tasks GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<AdvisorTasksCreateResponse>> {
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

    const forbidden = rejectForbiddenTaskFields(parsed.body);
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
    const titleResult = validateRequiredString(body.title, "title");
    if (!titleResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: titleResult.error },
        { status: 400 },
      );
    }

    const taskTypeResult = validateEnum<AdvisorTaskType>(
      body.task_type ?? body.taskType ?? "general",
      ADVISOR_TASK_TYPES,
      "task_type",
    );
    if (!taskTypeResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: taskTypeResult.error },
        { status: 400 },
      );
    }

    const priorityResult = validateEnum<AdvisorTaskPriority>(
      body.priority ?? "medium",
      ADVISOR_TASK_PRIORITIES,
      "priority",
    );
    if (!priorityResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: priorityResult.error },
        { status: 400 },
      );
    }

    const clientIdResult = parseOptionalClientId(body);
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

    const descriptionResult = parseOptionalDescription(body);
    if (!descriptionResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: descriptionResult.error },
        { status: 400 },
      );
    }

    const assignedResult = parseAssignedToUserId(
      body,
      access.authUser.id,
      role,
    );
    if (!assignedResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: assignedResult.error },
        { status: 400 },
      );
    }

    const relatedResult = parseRelatedEntity(body);
    if (!relatedResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: relatedResult.error },
        { status: 400 },
      );
    }

    const result = await createAdvisorTask(access.authUser.id, role, {
      clientId: clientIdResult.clientId,
      assignedToUserId: assignedResult.assignedToUserId,
      title: titleResult.value,
      description: descriptionResult.description,
      taskType: taskTypeResult.value,
      priority: priorityResult.value,
      dueDate: dueDateResult.dueDate,
      relatedEntityType: relatedResult.relatedEntityType,
      relatedEntityId: relatedResult.relatedEntityId,
    });

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

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: result.task.clientId,
      userId: access.authUser.id,
      action: "advisor_task_created",
      entityType: "advisor_tasks",
      entityId: result.task.id,
      metadata: {
        task_id: result.task.id,
        client_id: result.task.clientId,
        task_type: result.task.taskType,
        priority: result.task.priority,
        old_status: null,
        new_status: result.task.status,
        due_date: result.task.dueDate,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, task: result.task }, { status: 201 });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to create advisor task");
    console.error("[api/advisor/tasks POST]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
