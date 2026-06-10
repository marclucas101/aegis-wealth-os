import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  ADVISOR_TASK_PRIORITIES,
  ADVISOR_TASK_STATUSES,
  ADVISOR_TASK_TYPES,
  isValidDateString,
  rejectForbiddenTaskFields,
  updateAdvisorTask,
  type AdvisorTaskPriority,
  type AdvisorTaskRecord,
  type AdvisorTaskStatus,
  type AdvisorTaskType,
} from "@/lib/supabase/advisorTasks";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdvisorTaskUpdateResponse =
  | { ok: true; task: AdvisorTaskRecord }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "not_found" | "error";
      error?: string;
    };

type RouteContext = {
  params: Promise<{ taskId: string }>;
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

function auditActionForStatusChange(
  oldStatus: AdvisorTaskStatus,
  newStatus: AdvisorTaskStatus,
): "advisor_task_updated" | "advisor_task_completed" | "advisor_task_cancelled" {
  if (newStatus === "completed" && oldStatus !== "completed") {
    return "advisor_task_completed";
  }

  if (newStatus === "cancelled" && oldStatus !== "cancelled") {
    return "advisor_task_cancelled";
  }

  return "advisor_task_updated";
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorTaskUpdateResponse>> {
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

    const { taskId } = await context.params;
    if (!isValidUuid(taskId)) {
      return NextResponse.json(
        { ok: false, reason: "not_found", error: "Task not found" },
        { status: 404 },
      );
    }

    const rateLimit = rateLimitOrThrow<AdvisorTaskUpdateResponse>(request, {
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

    const forbidden = rejectForbiddenTaskFields(parsed.body);
    if (forbidden.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: forbidden.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      rejectClientId: false,
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

    const body = parsed.body as Record<string, unknown>;
    const patch: {
      title?: string;
      description?: string | null;
      taskType?: AdvisorTaskType;
      priority?: AdvisorTaskPriority;
      status?: AdvisorTaskStatus;
      dueDate?: string | null;
      assignedToUserId?: string;
    } = {};

    if ("title" in body) {
      const titleResult = validateRequiredString(body.title, "title");
      if (!titleResult.ok) {
        return NextResponse.json(
          { ok: false, reason: "error", error: titleResult.error },
          { status: 400 },
        );
      }

      patch.title = titleResult.value;
    }

    if ("description" in body) {
      if (body.description !== null && typeof body.description !== "string") {
        return NextResponse.json(
          { ok: false, reason: "error", error: "Missing or invalid description" },
          { status: 400 },
        );
      }

      patch.description =
        body.description === null
          ? null
          : (body.description as string).trim() || null;
    }

    if ("task_type" in body || "taskType" in body) {
      const taskTypeResult = validateEnum<AdvisorTaskType>(
        body.task_type ?? body.taskType,
        ADVISOR_TASK_TYPES,
        "task_type",
      );
      if (!taskTypeResult.ok) {
        return NextResponse.json(
          { ok: false, reason: "error", error: taskTypeResult.error },
          { status: 400 },
        );
      }

      patch.taskType = taskTypeResult.value;
    }

    if ("priority" in body) {
      const priorityResult = validateEnum<AdvisorTaskPriority>(
        body.priority,
        ADVISOR_TASK_PRIORITIES,
        "priority",
      );
      if (!priorityResult.ok) {
        return NextResponse.json(
          { ok: false, reason: "error", error: priorityResult.error },
          { status: 400 },
        );
      }

      patch.priority = priorityResult.value;
    }

    if ("status" in body) {
      const statusResult = validateEnum<AdvisorTaskStatus>(
        body.status,
        ADVISOR_TASK_STATUSES,
        "status",
      );
      if (!statusResult.ok) {
        return NextResponse.json(
          { ok: false, reason: "error", error: statusResult.error },
          { status: 400 },
        );
      }

      patch.status = statusResult.value;
    }

    if ("due_date" in body || "dueDate" in body) {
      const raw = body.due_date ?? body.dueDate;

      if (raw === null || raw === "") {
        patch.dueDate = null;
      } else if (typeof raw !== "string" || !isValidDateString(raw)) {
        return NextResponse.json(
          { ok: false, reason: "error", error: "Missing or invalid due_date" },
          { status: 400 },
        );
      } else {
        patch.dueDate = raw;
      }
    }

    if ("assigned_to_user_id" in body || "assignedToUserId" in body) {
      if (role === "advisor") {
        return NextResponse.json(
          {
            ok: false,
            reason: "error",
            error: "assigned_to_user_id must not be supplied by advisors",
          },
          { status: 400 },
        );
      }

      const raw = body.assigned_to_user_id ?? body.assignedToUserId;
      if (typeof raw !== "string" || !isValidUuid(raw)) {
        return NextResponse.json(
          {
            ok: false,
            reason: "error",
            error: "Missing or invalid assigned_to_user_id",
          },
          { status: 400 },
        );
      }

      patch.assignedToUserId = raw;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          reason: "error",
          error:
            "At least one field (title, description, task_type, priority, status, due_date) is required",
        },
        { status: 400 },
      );
    }

    const result = await updateAdvisorTask(
      access.authUser.id,
      role,
      taskId,
      patch,
    );

    if (!result.ok) {
      const status =
        result.reason === "forbidden"
          ? 403
          : result.reason === "not_found"
            ? 404
            : 500;

      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error:
            result.reason === "forbidden"
              ? "You do not have permission to update this task"
              : "Task not found",
        },
        { status },
      );
    }

    const metadata = getRequestMetadata(request);
    const previousStatus = result.oldStatus ?? result.task.status;
    const action = patch.status
      ? auditActionForStatusChange(previousStatus, patch.status)
      : "advisor_task_updated";

    await writeAuditLog({
      clientId: result.task.clientId,
      userId: access.authUser.id,
      action,
      entityType: "advisor_tasks",
      entityId: result.task.id,
      metadata: {
        task_id: result.task.id,
        client_id: result.task.clientId,
        task_type: result.task.taskType,
        priority: result.task.priority,
        old_status: previousStatus,
        new_status: result.task.status,
        due_date: result.task.dueDate,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, task: result.task });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to update advisor task");
    console.error("[api/advisor/tasks/[taskId] PATCH]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
