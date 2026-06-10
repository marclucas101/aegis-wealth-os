import "server-only";

import type { ShieldRating } from "@/src/lib/scoring/types";

import { createAdminSupabaseClient } from "./admin";
import {
  loadAdvisorReviewPipeline,
  type ReviewPipelineClient,
} from "./advisorReviewPipeline";
import {
  loadAdvisorTaskDashboard,
  type AdvisorTaskRecord,
} from "./advisorTasks";
import type { AppClientRow, ClientStatus } from "./userProfile";

export const ADVISOR_NOTIFICATION_TYPES = [
  "task_overdue",
  "task_due_today",
  "task_upcoming",
  "review_overdue",
  "review_due",
  "high_risk_client",
  "onboarding_incomplete",
  "discover_missing",
  "roadmap_stalled",
  "recent_document_uploaded",
  "recent_report_saved",
] as const;

export const ADVISOR_NOTIFICATION_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export type AdvisorNotificationType =
  (typeof ADVISOR_NOTIFICATION_TYPES)[number];

export type AdvisorNotificationPriority =
  (typeof ADVISOR_NOTIFICATION_PRIORITIES)[number];

export type AdvisorNotification = {
  id: string;
  type: AdvisorNotificationType;
  priority: AdvisorNotificationPriority;
  title: string;
  description: string;
  clientId: string | null;
  clientName: string | null;
  taskId: string | null;
  dueDate: string | null;
  detectedAt: string;
  actionLabel: string;
  actionHref: string;
};

export type AdvisorNotificationSummary = {
  totalCount: number;
  urgentCount: number;
  taskCount: number;
  reviewCount: number;
  clientCount: number;
  documentCount: number;
  overdueTaskCount: number;
  overdueReviewCount: number;
  dueTodayTaskCount: number;
};

export type AdvisorNotificationsPayload = {
  notifications: AdvisorNotification[];
  summary: AdvisorNotificationSummary;
};

const RECENT_ACTIVITY_DAYS = 7;
const ROADMAP_STALLED_MAX_PERCENT = 50;
const ROADMAP_STALLED_MIN_INCOMPLETE = 2;
const ONBOARDING_STATUSES: ClientStatus[] = ["onboarding", "prospect"];
const HIGH_PRIORITY_RATINGS: ShieldRating[] = ["BB", "B"];
const LOW_SHIELD_THRESHOLD = 60;

const DOCUMENT_AUDIT_ACTIONS = [
  "document_upload",
  "document_uploaded",
  "advisor_document_uploaded",
] as const;

const REPORT_AUDIT_ACTIONS = [
  "annual_review_saved",
  "wealth_blueprint_saved",
] as const;

const PRIORITY_RANK: Record<AdvisorNotificationPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const TASK_TYPES: AdvisorNotificationType[] = [
  "task_overdue",
  "task_due_today",
  "task_upcoming",
];

const REVIEW_TYPES: AdvisorNotificationType[] = [
  "review_overdue",
  "review_due",
];

const CLIENT_TYPES: AdvisorNotificationType[] = [
  "high_risk_client",
  "onboarding_incomplete",
  "discover_missing",
  "roadmap_stalled",
];

const DOCUMENT_TYPES: AdvisorNotificationType[] = [
  "recent_document_uploaded",
  "recent_report_saved",
];

type DiscoverSummary = {
  client_id: string;
  completed_at: string | null;
};

type RoadmapSummary = {
  client_id: string;
  status: "not_started" | "in_progress" | "completed";
};

type DocumentSummary = {
  client_id: string;
  created_at: string;
};

type AuditLogSummary = {
  id: string;
  client_id: string | null;
  action: string;
  entity_type: string;
  created_at: string;
};

function clientWorkspaceHref(clientId: string): string {
  return `/advisor/clients/${clientId}`;
}

function taskPriorityToNotificationPriority(
  taskPriority: AdvisorTaskRecord["priority"],
  base: AdvisorNotificationPriority,
): AdvisorNotificationPriority {
  if (taskPriority === "urgent") return "urgent";
  if (taskPriority === "high" && base !== "urgent") return "high";
  return base;
}

function buildTaskNotifications(tasks: AdvisorTaskRecord[]): AdvisorNotification[] {
  const notifications: AdvisorNotification[] = [];
  const now = new Date().toISOString();

  for (const task of tasks) {
    const clientLabel = task.clientDisplayName ?? "Unassigned task";
    const actionHref = task.clientId
      ? clientWorkspaceHref(task.clientId)
      : "/advisor#advisor-tasks";

    notifications.push({
      id: `task_overdue:${task.id}`,
      type: "task_overdue",
      priority: taskPriorityToNotificationPriority(task.priority, "high"),
      title: "Overdue task",
      description: `${task.title} · ${clientLabel}`,
      clientId: task.clientId,
      clientName: task.clientDisplayName,
      taskId: task.id,
      dueDate: task.dueDate,
      detectedAt: task.dueDate ? `${task.dueDate}T00:00:00.000Z` : now,
      actionLabel: task.clientId ? "Open client" : "View tasks",
      actionHref,
    });
  }

  return notifications;
}

function buildDueTodayTaskNotifications(
  tasks: AdvisorTaskRecord[],
): AdvisorNotification[] {
  return tasks.map((task) => ({
    id: `task_due_today:${task.id}`,
    type: "task_due_today" as const,
    priority: taskPriorityToNotificationPriority(task.priority, "medium"),
    title: "Task due today",
    description: `${task.title}${task.clientDisplayName ? ` · ${task.clientDisplayName}` : ""}`,
    clientId: task.clientId,
    clientName: task.clientDisplayName,
    taskId: task.id,
    dueDate: task.dueDate,
    detectedAt: task.dueDate ? `${task.dueDate}T00:00:00.000Z` : new Date().toISOString(),
    actionLabel: task.clientId ? "Open client" : "View tasks",
    actionHref: task.clientId
      ? clientWorkspaceHref(task.clientId)
      : "/advisor#advisor-tasks",
  }));
}

function buildUpcomingTaskNotifications(
  tasks: AdvisorTaskRecord[],
): AdvisorNotification[] {
  return tasks.map((task) => ({
    id: `task_upcoming:${task.id}`,
    type: "task_upcoming" as const,
    priority: taskPriorityToNotificationPriority(task.priority, "low"),
    title: "Upcoming task",
    description: `${task.title}${task.clientDisplayName ? ` · ${task.clientDisplayName}` : ""}`,
    clientId: task.clientId,
    clientName: task.clientDisplayName,
    taskId: task.id,
    dueDate: task.dueDate,
    detectedAt: task.dueDate ? `${task.dueDate}T00:00:00.000Z` : task.createdAt,
    actionLabel: task.clientId ? "Open client" : "View tasks",
    actionHref: task.clientId
      ? clientWorkspaceHref(task.clientId)
      : "/advisor#advisor-tasks",
  }));
}

function buildReviewOverdueNotification(
  client: ReviewPipelineClient,
): AdvisorNotification {
  return {
    id: `review_overdue:${client.clientId}`,
    type: "review_overdue",
    priority: "urgent",
    title: "Annual review overdue",
    description: `${client.displayName} · last review ${
      client.lastAnnualReviewDate
        ? new Date(client.lastAnnualReviewDate).toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "not on file"
    }`,
    clientId: client.clientId,
    clientName: client.displayName,
    taskId: null,
    dueDate: client.nextRecommendedReviewDate
      ? client.nextRecommendedReviewDate.slice(0, 10)
      : null,
    detectedAt:
      client.lastAnnualReviewDate ??
      client.nextRecommendedReviewDate ??
      new Date().toISOString(),
    actionLabel: "Review client",
    actionHref: clientWorkspaceHref(client.clientId),
  };
}

function buildReviewDueNotification(
  client: ReviewPipelineClient,
): AdvisorNotification {
  return {
    id: `review_due:${client.clientId}`,
    type: "review_due",
    priority: "high",
    title: "Annual review due",
    description: `${client.displayName} · ${client.recommendedNextAction}`,
    clientId: client.clientId,
    clientName: client.displayName,
    taskId: null,
    dueDate: client.nextRecommendedReviewDate
      ? client.nextRecommendedReviewDate.slice(0, 10)
      : null,
    detectedAt:
      client.nextRecommendedReviewDate ??
      new Date().toISOString(),
    actionLabel: "Schedule review",
    actionHref: clientWorkspaceHref(client.clientId),
  };
}

function buildHighRiskNotification(
  client: ReviewPipelineClient,
): AdvisorNotification {
  const reasons =
    client.priorityReasons.length > 0
      ? client.priorityReasons.join(" · ")
      : "Elevated risk signals detected";

  return {
    id: `high_risk_client:${client.clientId}`,
    type: "high_risk_client",
    priority: "high",
    title: "High-risk client",
    description: `${client.displayName} · ${reasons}`,
    clientId: client.clientId,
    clientName: client.displayName,
    taskId: null,
    dueDate: null,
    detectedAt: new Date().toISOString(),
    actionLabel: "Open client",
    actionHref: clientWorkspaceHref(client.clientId),
  };
}

function buildOnboardingNotification(
  client: ReviewPipelineClient,
): AdvisorNotification {
  return {
    id: `onboarding_incomplete:${client.clientId}`,
    type: "onboarding_incomplete",
    priority: "medium",
    title: "Onboarding incomplete",
    description: `${client.displayName} · ${client.recommendedNextAction}`,
    clientId: client.clientId,
    clientName: client.displayName,
    taskId: null,
    dueDate: null,
    detectedAt: new Date().toISOString(),
    actionLabel: "Complete onboarding",
    actionHref: clientWorkspaceHref(client.clientId),
  };
}

function buildDiscoverMissingNotification(
  client: AppClientRow,
): AdvisorNotification {
  return {
    id: `discover_missing:${client.id}`,
    type: "discover_missing",
    priority: ONBOARDING_STATUSES.includes(client.status) ? "medium" : "high",
    title: "Discover profile missing",
    description: `${client.display_name} has no completed Discover profile`,
    clientId: client.id,
    clientName: client.display_name,
    taskId: null,
    dueDate: null,
    detectedAt: client.updated_at,
    actionLabel: "Open client",
    actionHref: clientWorkspaceHref(client.id),
  };
}

function buildRoadmapStalledNotification(input: {
  client: AppClientRow;
  incompleteCount: number;
  completionPercent: number;
}): AdvisorNotification {
  return {
    id: `roadmap_stalled:${input.client.id}`,
    type: "roadmap_stalled",
    priority: "medium",
    title: "Roadmap progress stalled",
    description: `${input.client.display_name} · ${input.incompleteCount} open items · ${input.completionPercent}% complete`,
    clientId: input.client.id,
    clientName: input.client.display_name,
    taskId: null,
    dueDate: null,
    detectedAt: input.client.updated_at,
    actionLabel: "Review roadmap",
    actionHref: clientWorkspaceHref(input.client.id),
  };
}

function buildDocumentNotification(input: {
  clientId: string;
  clientName: string;
  detectedAt: string;
  sourceId: string;
  description: string;
}): AdvisorNotification {
  return {
    id: `recent_document_uploaded:${input.sourceId}`,
    type: "recent_document_uploaded",
    priority: "low",
    title: "Document uploaded",
    description: input.description,
    clientId: input.clientId,
    clientName: input.clientName,
    taskId: null,
    dueDate: null,
    detectedAt: input.detectedAt,
    actionLabel: "View documents",
    actionHref: clientWorkspaceHref(input.clientId),
  };
}

function buildReportNotification(input: {
  clientId: string;
  clientName: string;
  detectedAt: string;
  sourceId: string;
  reportLabel: string;
}): AdvisorNotification {
  return {
    id: `recent_report_saved:${input.sourceId}`,
    type: "recent_report_saved",
    priority: "medium",
    title: "Report saved",
    description: `${input.clientName} · ${input.reportLabel}`,
    clientId: input.clientId,
    clientName: input.clientName,
    taskId: null,
    dueDate: null,
    detectedAt: input.detectedAt,
    actionLabel: "View reports",
    actionHref: clientWorkspaceHref(input.clientId),
  };
}

function isWithinRecentWindow(isoDate: string, days: number): boolean {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

function computeRoadmapCompletion(items: RoadmapSummary[]): {
  percent: number;
  incompleteCount: number;
} {
  if (items.length === 0) {
    return { percent: 100, incompleteCount: 0 };
  }

  const completed = items.filter((item) => item.status === "completed").length;
  const incompleteCount = items.length - completed;
  return {
    percent: Math.round((completed / items.length) * 100),
    incompleteCount,
  };
}

function sortNotifications(
  notifications: AdvisorNotification[],
): AdvisorNotification[] {
  return [...notifications].sort((a, b) => {
    const priorityDiff =
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const aTime = new Date(a.detectedAt).getTime();
    const bTime = new Date(b.detectedAt).getTime();
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }

    return a.title.localeCompare(b.title);
  });
}

function buildSummary(
  notifications: AdvisorNotification[],
  taskSummary: {
    overdueCount: number;
    dueTodayCount: number;
  },
  reviewSummary: {
    overdueCount: number;
    dueThisMonthCount: number;
  },
): AdvisorNotificationSummary {
  return {
    totalCount: notifications.length,
    urgentCount: notifications.filter((n) => n.priority === "urgent").length,
    taskCount: notifications.filter((n) => TASK_TYPES.includes(n.type)).length,
    reviewCount: notifications.filter((n) =>
      REVIEW_TYPES.includes(n.type),
    ).length,
    clientCount: notifications.filter((n) => CLIENT_TYPES.includes(n.type))
      .length,
    documentCount: notifications.filter((n) =>
      DOCUMENT_TYPES.includes(n.type),
    ).length,
    overdueTaskCount: taskSummary.overdueCount,
    overdueReviewCount: reviewSummary.overdueCount,
    dueTodayTaskCount: taskSummary.dueTodayCount,
  };
}

async function loadAccessibleClients(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AppClientRow[]> {
  const admin = createAdminSupabaseClient();

  let query = admin
    .from("clients")
    .select("*")
    .neq("status", "archived")
    .order("display_name", { ascending: true });

  if (userRole === "advisor") {
    query = query.eq("advisor_user_id", authUserId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load advisor clients: ${error.message}`);
  }

  return (data ?? []) as AppClientRow[];
}

async function loadClientContextMaps(clientIds: string[]): Promise<{
  discoverByClient: Map<string, DiscoverSummary>;
  roadmapByClient: Map<string, RoadmapSummary[]>;
  documentsByClient: Map<string, DocumentSummary[]>;
  auditByClient: AuditLogSummary[];
}> {
  if (clientIds.length === 0) {
    return {
      discoverByClient: new Map(),
      roadmapByClient: new Map(),
      documentsByClient: new Map(),
      auditByClient: [],
    };
  }

  const admin = createAdminSupabaseClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_ACTIVITY_DAYS);
  const cutoffIso = cutoff.toISOString();

  const [discoverResult, roadmapResult, documentsResult, auditResult] =
    await Promise.all([
      admin
        .from("discover_profiles")
        .select("client_id, completed_at")
        .in("client_id", clientIds)
        .eq("is_current", true),
      admin
        .from("roadmap_items")
        .select("client_id, status")
        .in("client_id", clientIds)
        .eq("is_active", true),
      admin
        .from("documents")
        .select("client_id, created_at")
        .in("client_id", clientIds)
        .eq("is_archived", false)
        .gte("created_at", cutoffIso)
        .order("created_at", { ascending: false }),
      admin
        .from("audit_logs")
        .select("id, client_id, action, entity_type, created_at")
        .in("client_id", clientIds)
        .gte("created_at", cutoffIso)
        .order("created_at", { ascending: false }),
    ]);

  if (discoverResult.error) {
    throw new Error(
      `Failed to load discover profiles: ${discoverResult.error.message}`,
    );
  }
  if (roadmapResult.error) {
    throw new Error(
      `Failed to load roadmap items: ${roadmapResult.error.message}`,
    );
  }
  if (documentsResult.error) {
    throw new Error(`Failed to load documents: ${documentsResult.error.message}`);
  }
  if (auditResult.error) {
    throw new Error(`Failed to load audit logs: ${auditResult.error.message}`);
  }

  const discoverByClient = new Map<string, DiscoverSummary>();
  for (const row of (discoverResult.data ?? []) as DiscoverSummary[]) {
    discoverByClient.set(row.client_id, row);
  }

  const roadmapByClient = new Map<string, RoadmapSummary[]>();
  for (const row of (roadmapResult.data ?? []) as RoadmapSummary[]) {
    const existing = roadmapByClient.get(row.client_id) ?? [];
    existing.push(row);
    roadmapByClient.set(row.client_id, existing);
  }

  const documentsByClient = new Map<string, DocumentSummary[]>();
  for (const row of (documentsResult.data ?? []) as DocumentSummary[]) {
    const existing = documentsByClient.get(row.client_id) ?? [];
    existing.push(row);
    documentsByClient.set(row.client_id, existing);
  }

  return {
    discoverByClient,
    roadmapByClient,
    documentsByClient,
    auditByClient: (auditResult.data ?? []) as AuditLogSummary[],
  };
}

function isHighRiskPipelineClient(client: ReviewPipelineClient): boolean {
  return (
    (client.adjustedShieldScore != null &&
      client.adjustedShieldScore < LOW_SHIELD_THRESHOLD) ||
    (client.rating != null && HIGH_PRIORITY_RATINGS.includes(client.rating)) ||
    client.priorityReasons.includes("Severe stress exposure")
  );
}

function reportLabelForAction(action: string): string {
  if (action === "annual_review_saved") {
    return "Annual review saved";
  }

  if (action === "wealth_blueprint_saved") {
    return "Wealth blueprint saved";
  }

  return "Report saved";
}

/**
 * Computes read-only advisor notifications from existing operational data.
 * Scope is resolved server-side from the authenticated advisor/admin.
 */
export async function loadAdvisorNotifications(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AdvisorNotificationsPayload> {
  const [taskDashboard, reviewPipeline, clients] = await Promise.all([
    loadAdvisorTaskDashboard(authUserId, userRole),
    loadAdvisorReviewPipeline(authUserId, userRole),
    loadAccessibleClients(authUserId, userRole),
  ]);

  const clientNameById = new Map(
    clients.map((client) => [client.id, client.display_name]),
  );

  const clientIds = clients.map((client) => client.id);
  const contextMaps = await loadClientContextMaps(clientIds);

  const notifications: AdvisorNotification[] = [
    ...buildTaskNotifications(taskDashboard.overdue),
    ...buildDueTodayTaskNotifications(taskDashboard.dueToday),
    ...buildUpcomingTaskNotifications(taskDashboard.upcoming),
  ];

  const reviewOverdueIds = new Set<string>();
  for (const client of reviewPipeline.overdue) {
    notifications.push(buildReviewOverdueNotification(client));
    reviewOverdueIds.add(client.clientId);
  }

  const reviewDueIds = new Set<string>();
  for (const client of reviewPipeline.dueThisMonth) {
    if (reviewOverdueIds.has(client.clientId)) continue;
    notifications.push(buildReviewDueNotification(client));
    reviewDueIds.add(client.clientId);
  }

  const onboardingIds = new Set<string>();
  for (const client of reviewPipeline.onboarding) {
    notifications.push(buildOnboardingNotification(client));
    onboardingIds.add(client.clientId);
  }

  for (const client of reviewPipeline.highPriority) {
    if (
      reviewOverdueIds.has(client.clientId) ||
      reviewDueIds.has(client.clientId) ||
      onboardingIds.has(client.clientId)
    ) {
      continue;
    }

    if (isHighRiskPipelineClient(client)) {
      notifications.push(buildHighRiskNotification(client));
    }
  }

  for (const client of clients) {
    const discover = contextMaps.discoverByClient.get(client.id);
    const hasCompletedDiscover = Boolean(discover?.completed_at);

    if (!hasCompletedDiscover && !onboardingIds.has(client.id)) {
      notifications.push(buildDiscoverMissingNotification(client));
    }

    const roadmapItems = contextMaps.roadmapByClient.get(client.id) ?? [];
    const { percent, incompleteCount } = computeRoadmapCompletion(roadmapItems);

    if (
      roadmapItems.length > 0 &&
      incompleteCount >= ROADMAP_STALLED_MIN_INCOMPLETE &&
      percent <= ROADMAP_STALLED_MAX_PERCENT &&
      client.status !== "archived"
    ) {
      notifications.push(
        buildRoadmapStalledNotification({
          client,
          incompleteCount,
          completionPercent: percent,
        }),
      );
    }
  }

  const seenDocumentClients = new Set<string>();
  for (const row of contextMaps.auditByClient) {
    if (!row.client_id) continue;

    const clientName = clientNameById.get(row.client_id);
    if (!clientName) continue;

    if (
      (DOCUMENT_AUDIT_ACTIONS as readonly string[]).includes(row.action) &&
      isWithinRecentWindow(row.created_at, RECENT_ACTIVITY_DAYS) &&
      !seenDocumentClients.has(row.client_id)
    ) {
      seenDocumentClients.add(row.client_id);
      notifications.push(
        buildDocumentNotification({
          clientId: row.client_id,
          clientName,
          detectedAt: row.created_at,
          sourceId: row.id,
          description: `${clientName} · document uploaded recently`,
        }),
      );
    }
  }

  for (const [clientId, documents] of contextMaps.documentsByClient) {
    if (seenDocumentClients.has(clientId)) continue;

    const latest = documents[0];
    const clientName = clientNameById.get(clientId);
    if (!latest || !clientName) continue;

    if (!isWithinRecentWindow(latest.created_at, RECENT_ACTIVITY_DAYS)) {
      continue;
    }

    seenDocumentClients.add(clientId);
    notifications.push(
      buildDocumentNotification({
        clientId,
        clientName,
        detectedAt: latest.created_at,
        sourceId: `doc:${clientId}:${latest.created_at}`,
        description: `${clientName} · document uploaded recently`,
      }),
    );
  }

  const seenReportClients = new Set<string>();
  for (const row of contextMaps.auditByClient) {
    if (!row.client_id) continue;

    const clientName = clientNameById.get(row.client_id);
    if (!clientName) continue;

    if (
      (REPORT_AUDIT_ACTIONS as readonly string[]).includes(row.action) &&
      isWithinRecentWindow(row.created_at, RECENT_ACTIVITY_DAYS) &&
      !seenReportClients.has(`${row.client_id}:${row.action}`)
    ) {
      seenReportClients.add(`${row.client_id}:${row.action}`);
      notifications.push(
        buildReportNotification({
          clientId: row.client_id,
          clientName,
          detectedAt: row.created_at,
          sourceId: row.id,
          reportLabel: reportLabelForAction(row.action),
        }),
      );
    }
  }

  const sorted = sortNotifications(notifications);

  return {
    notifications: sorted,
    summary: buildSummary(sorted, taskDashboard.summary, reviewPipeline.summary),
  };
}
