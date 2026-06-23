import "server-only";

import { syncReviewSubmissionOnTaskComplete } from "@/lib/compliance/reviewSubmissionLifecycle";
import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const ADVISOR_TASK_TYPES = [
  "general",
  "review",
  "follow_up",
  "document",
  "roadmap",
  "risk",
  "client_birthday",
] as const;

export const ADVISOR_TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const ADVISOR_TASK_STATUSES = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type AdvisorTaskType = (typeof ADVISOR_TASK_TYPES)[number];
export type AdvisorTaskPriority = (typeof ADVISOR_TASK_PRIORITIES)[number];
export type AdvisorTaskStatus = (typeof ADVISOR_TASK_STATUSES)[number];

export type AdvisorTaskRecord = {
  id: string;
  clientId: string | null;
  clientDisplayName: string | null;
  assignedToUserId: string;
  createdByUserId: string;
  title: string;
  description: string | null;
  taskType: AdvisorTaskType;
  priority: AdvisorTaskPriority;
  status: AdvisorTaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  sourceKey: string | null;
  dismissedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AdvisorTaskDashboard = {
  dueToday: AdvisorTaskRecord[];
  overdue: AdvisorTaskRecord[];
  upcoming: AdvisorTaskRecord[];
  highPriority: AdvisorTaskRecord[];
  recentlyCompleted: AdvisorTaskRecord[];
  summary: {
    dueTodayCount: number;
    overdueCount: number;
    upcomingCount: number;
    highPriorityCount: number;
    recentlyCompletedCount: number;
  };
};

type AdvisorTaskRow = {
  id: string;
  client_id: string | null;
  assigned_to_user_id: string;
  created_by_user_id: string;
  title: string;
  description: string | null;
  task_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  source_key: string | null;
  dismissed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  clients?: { display_name: string } | { display_name: string }[] | null;
};

export type AdvisorTaskAccessResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; client: AppClientRow | null };

export type AdvisorTaskMutationResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; task: AdvisorTaskRecord; oldStatus?: AdvisorTaskStatus };

const DEFAULT_TASK_TYPE: AdvisorTaskType = "general";
const DEFAULT_PRIORITY: AdvisorTaskPriority = "medium";
const DEFAULT_STATUS: AdvisorTaskStatus = "open";
const RECENTLY_COMPLETED_DAYS = 30;
const UPCOMING_WINDOW_DAYS = 30;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function mapTaskType(value: string | null | undefined): AdvisorTaskType {
  if (
    value &&
    (ADVISOR_TASK_TYPES as readonly string[]).includes(value)
  ) {
    return value as AdvisorTaskType;
  }

  return DEFAULT_TASK_TYPE;
}

function mapPriority(value: string | null | undefined): AdvisorTaskPriority {
  if (
    value &&
    (ADVISOR_TASK_PRIORITIES as readonly string[]).includes(value)
  ) {
    return value as AdvisorTaskPriority;
  }

  return DEFAULT_PRIORITY;
}

function mapStatus(value: string | null | undefined): AdvisorTaskStatus {
  if (
    value &&
    (ADVISOR_TASK_STATUSES as readonly string[]).includes(value)
  ) {
    return value as AdvisorTaskStatus;
  }

  return DEFAULT_STATUS;
}

function resolveClientDisplayName(
  clients: AdvisorTaskRow["clients"],
): string | null {
  if (!clients) return null;
  if (Array.isArray(clients)) {
    return clients[0]?.display_name ?? null;
  }

  return clients.display_name ?? null;
}

function mapTaskRow(row: AdvisorTaskRow): AdvisorTaskRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    clientDisplayName: resolveClientDisplayName(row.clients),
    assignedToUserId: row.assigned_to_user_id,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    description: row.description,
    taskType: mapTaskType(row.task_type),
    priority: mapPriority(row.priority),
    status: mapStatus(row.status),
    dueDate: row.due_date,
    completedAt: row.completed_at,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    sourceKey: row.source_key,
    dismissedAt: row.dismissed_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isActiveStatus(status: AdvisorTaskStatus): boolean {
  return status === "open" || status === "in_progress";
}

/**
 * Rejects request bodies that attempt to supply identity fields from the browser.
 * assigned_to_user_id may be accepted only for admins (validated separately).
 */
export function rejectForbiddenTaskFields(body: unknown): {
  rejected: boolean;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { rejected: false };
  }

  const forbidden = [
    "advisor_id",
    "advisorId",
    "advisor_user_id",
    "advisorUserId",
    "user_id",
    "userId",
    "created_by_user_id",
    "createdByUserId",
    "created_by",
    "createdBy",
  ] as const;

  for (const key of forbidden) {
    if (key in body) {
      return {
        rejected: true,
        error: `${key} must not be supplied by the client`,
      };
    }
  }

  return { rejected: false };
}

async function resolveAccessibleClient(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<AdvisorTaskAccessResult> {
  if (!isValidUuid(clientId)) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client: ${error.message}`);
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  const client = data as AppClientRow;

  if (userRole === "advisor" && client.advisor_user_id !== authUserId) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, client };
}

async function loadAssignedClientIds(authUserId: string): Promise<string[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .select("id")
    .eq("advisor_user_id", authUserId);

  if (error) {
    throw new Error(`Failed to load assigned clients: ${error.message}`);
  }

  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

function buildAdvisorVisibilityFilter(
  authUserId: string,
  assignedClientIds: string[],
): string {
  const clauses = [
    `assigned_to_user_id.eq.${authUserId}`,
    `created_by_user_id.eq.${authUserId}`,
  ];

  if (assignedClientIds.length > 0) {
    clauses.push(`client_id.in.(${assignedClientIds.join(",")})`);
  }

  return clauses.join(",");
}

async function loadTaskById(taskId: string): Promise<AdvisorTaskRow | null> {
  if (!isValidUuid(taskId)) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("advisor_tasks")
    .select("*, clients(display_name)")
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load advisor task: ${error.message}`);
  }

  return (data as AdvisorTaskRow | null) ?? null;
}

async function canAccessTask(
  authUserId: string,
  userRole: "advisor" | "admin",
  task: AdvisorTaskRow,
): Promise<boolean> {
  if (userRole === "admin") {
    return true;
  }

  if (
    task.assigned_to_user_id === authUserId ||
    task.created_by_user_id === authUserId
  ) {
    return true;
  }

  if (!task.client_id) {
    return false;
  }

  const access = await resolveAccessibleClient(
    authUserId,
    userRole,
    task.client_id,
  );

  return access.ok;
}

async function canMutateTask(
  authUserId: string,
  userRole: "advisor" | "admin",
  task: AdvisorTaskRow,
): Promise<boolean> {
  if (userRole === "admin") {
    return true;
  }

  if (
    task.assigned_to_user_id === authUserId ||
    task.created_by_user_id === authUserId
  ) {
    return true;
  }

  if (!task.client_id) {
    return false;
  }

  const access = await resolveAccessibleClient(
    authUserId,
    userRole,
    task.client_id,
  );

  return access.ok;
}

function categorizeDashboardTasks(tasks: AdvisorTaskRecord[]): AdvisorTaskDashboard {
  const today = todayDateString();
  const upcomingCutoff = addDays(today, UPCOMING_WINDOW_DAYS);
  const recentlyCompletedCutoff = new Date();
  recentlyCompletedCutoff.setDate(
    recentlyCompletedCutoff.getDate() - RECENTLY_COMPLETED_DAYS,
  );

  const dueToday: AdvisorTaskRecord[] = [];
  const overdue: AdvisorTaskRecord[] = [];
  const upcoming: AdvisorTaskRecord[] = [];
  const highPriority: AdvisorTaskRecord[] = [];
  const recentlyCompleted: AdvisorTaskRecord[] = [];

  for (const task of tasks) {
    if (isActiveStatus(task.status)) {
      if (task.dueDate === today) {
        dueToday.push(task);
      }

      if (task.dueDate && task.dueDate < today) {
        overdue.push(task);
      }

      if (
        task.dueDate &&
        task.dueDate > today &&
        task.dueDate <= upcomingCutoff
      ) {
        upcoming.push(task);
      }

      if (task.priority === "high" || task.priority === "urgent") {
        highPriority.push(task);
      }
    }

    if (task.status === "completed" && task.completedAt) {
      const completedAt = new Date(task.completedAt);
      if (!Number.isNaN(completedAt.getTime()) && completedAt >= recentlyCompletedCutoff) {
        recentlyCompleted.push(task);
      }
    }
  }

  const sortByDueDate = (a: AdvisorTaskRecord, b: AdvisorTaskRecord) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  };

  dueToday.sort(sortByDueDate);
  overdue.sort(sortByDueDate);
  upcoming.sort(sortByDueDate);
  highPriority.sort((a, b) => {
    const priorityRank: Record<AdvisorTaskPriority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const rankDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (rankDiff !== 0) return rankDiff;
    return sortByDueDate(a, b);
  });
  recentlyCompleted.sort((a, b) =>
    (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
  );

  return {
    dueToday,
    overdue,
    upcoming,
    highPriority,
    recentlyCompleted,
    summary: {
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
      highPriorityCount: highPriority.length,
      recentlyCompletedCount: recentlyCompleted.length,
    },
  };
}

export async function loadAdvisorTaskDashboard(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AdvisorTaskDashboard> {
  const admin = createAdminSupabaseClient();

  let query = admin
    .from("advisor_tasks")
    .select("*, clients(display_name)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (userRole === "advisor") {
    const assignedClientIds = await loadAssignedClientIds(authUserId);
    const visibilityFilter = buildAdvisorVisibilityFilter(
      authUserId,
      assignedClientIds,
    );
    query = query.or(visibilityFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load advisor tasks: ${error.message}`);
  }

  const tasks = ((data ?? []) as AdvisorTaskRow[]).map(mapTaskRow);
  return categorizeDashboardTasks(tasks);
}

export async function listAdvisorTasksForClient(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { ok: false; reason: "not_found" | "forbidden" }
  | { ok: true; tasks: AdvisorTaskRecord[] }
> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (!access.ok) {
    return { ok: false, reason: access.reason };
  }

  const admin = createAdminSupabaseClient();
  let query = admin
    .from("advisor_tasks")
    .select("*, clients(display_name)")
    .eq("client_id", clientId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (userRole === "advisor") {
    const visibilityFilter = buildAdvisorVisibilityFilter(authUserId, [clientId]);
    query = query.or(visibilityFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list advisor tasks: ${error.message}`);
  }

  return {
    ok: true,
    tasks: ((data ?? []) as AdvisorTaskRow[]).map(mapTaskRow),
  };
}

export async function createAdvisorTask(
  authUserId: string,
  userRole: "advisor" | "admin",
  input: {
    clientId: string | null;
    assignedToUserId: string;
    title: string;
    description: string | null;
    taskType: AdvisorTaskType;
    priority: AdvisorTaskPriority;
    dueDate: string | null;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
  },
): Promise<AdvisorTaskMutationResult> {
  if (!isValidUuid(input.assignedToUserId)) {
    return { ok: false, reason: "not_found" };
  }

  if (userRole === "advisor" && input.assignedToUserId !== authUserId) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.clientId) {
    const access = await resolveAccessibleClient(
      authUserId,
      userRole,
      input.clientId,
    );

    if (!access.ok) {
      return { ok: false, reason: access.reason };
    }
  }

  if (input.relatedEntityId && !isValidUuid(input.relatedEntityId)) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("advisor_tasks")
    .insert({
      client_id: input.clientId,
      assigned_to_user_id: input.assignedToUserId,
      created_by_user_id: authUserId,
      title: input.title,
      description: input.description,
      task_type: input.taskType,
      priority: input.priority,
      status: DEFAULT_STATUS,
      due_date: input.dueDate,
      related_entity_type: input.relatedEntityType,
      related_entity_id: input.relatedEntityId,
    } as never)
    .select("*, clients(display_name)")
    .single();

  if (error) {
    throw new Error(`Failed to create advisor task: ${error.message}`);
  }

  return { ok: true, task: mapTaskRow(data as AdvisorTaskRow) };
}

export async function updateAdvisorTask(
  authUserId: string,
  userRole: "advisor" | "admin",
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    taskType?: AdvisorTaskType;
    priority?: AdvisorTaskPriority;
    status?: AdvisorTaskStatus;
    dueDate?: string | null;
    assignedToUserId?: string;
  },
): Promise<AdvisorTaskMutationResult> {
  const existing = await loadTaskById(taskId);

  if (!existing) {
    return { ok: false, reason: "not_found" };
  }

  const hasAccess = await canAccessTask(authUserId, userRole, existing);
  if (!hasAccess) {
    return { ok: false, reason: "forbidden" };
  }

  if (!(await canMutateTask(authUserId, userRole, existing))) {
    return { ok: false, reason: "forbidden" };
  }

  const patch: Record<string, unknown> = {};

  if (input.title !== undefined) {
    patch.title = input.title;
  }

  if ("description" in input) {
    patch.description = input.description;
  }

  if (input.taskType !== undefined) {
    patch.task_type = input.taskType;
  }

  if (input.priority !== undefined) {
    patch.priority = input.priority;
  }

  if (input.dueDate !== undefined) {
    patch.due_date = input.dueDate;
  }

  if (input.assignedToUserId !== undefined) {
    if (!isValidUuid(input.assignedToUserId)) {
      return { ok: false, reason: "not_found" };
    }

    if (userRole === "advisor" && input.assignedToUserId !== authUserId) {
      return { ok: false, reason: "forbidden" };
    }

    patch.assigned_to_user_id = input.assignedToUserId;
  }

  if (input.status !== undefined) {
    patch.status = input.status;

    if (input.status === "completed") {
      patch.completed_at = new Date().toISOString();
    } else if (existing.status === "completed") {
      patch.completed_at = null;
    }

    if (input.status === "cancelled") {
      patch.dismissed_at = new Date().toISOString();
    } else if (existing.status === "cancelled") {
      patch.dismissed_at = null;
    }
  }

  const oldStatus = mapStatus(existing.status);

  if (Object.keys(patch).length === 0) {
    return { ok: true, task: mapTaskRow(existing), oldStatus };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("advisor_tasks")
    .update(patch as never)
    .eq("id", taskId)
    .select("*, clients(display_name)")
    .single();

  if (error) {
    throw new Error(`Failed to update advisor task: ${error.message}`);
  }

  const task = mapTaskRow(data as AdvisorTaskRow);

  if (input.status === "completed" && oldStatus !== "completed") {
    await syncReviewSubmissionOnTaskComplete({
      sourceKey: existing.source_key,
      clientId: existing.client_id,
      actorUserId: authUserId,
    });
  }

  return {
    ok: true,
    task,
    oldStatus,
  };
}
