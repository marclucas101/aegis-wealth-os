import "server-only";

import {
  CRM_V2_RELATIONSHIPS_DEFAULT_PAGE_SIZE,
  CRM_V2_RELATIONSHIPS_MAX_PAGE_SIZE,
} from "@/lib/crm-v2/constants";
import {
  buildRelationshipDetailHref,
} from "@/lib/crm-v2/relationships/routes";
import type { CrmRelationshipListItem, CrmRelationshipListPage } from "@/lib/crm-v2/relationships/types";
import {
  CRM_NOT_ESTABLISHED_LABEL,
  CRM_NOT_SCHEDULED_LABEL,
  CRM_UNKNOWN_LABEL,
} from "@/lib/crm-v2/relationships/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ClientStatus, RelationshipStage } from "@/lib/supabase/userProfile";

const OPEN_TASK_STATUSES = ["open", "in_progress"] as const;

const VALID_STATUSES = new Set<ClientStatus | "all">([
  "all",
  "active",
  "onboarding",
  "prospect",
  "review_due",
  "archived",
]);

const VALID_STAGES = new Set<RelationshipStage | "all">([
  "all",
  "prospect",
  "fact_find_complete",
  "adviser_review",
  "meeting_scheduled",
  "recommendation_prepared",
  "active_client",
  "inactive_client",
]);

export type CrmRelationshipListFilters = {
  q?: string;
  status?: ClientStatus | "all";
  stage?: RelationshipStage | "all";
  reviewStatus?: "all" | "due" | "current";
  hasUpcomingAppointment?: boolean;
  needsAttention?: boolean;
  page?: number;
  pageSize?: number;
};

function formatServicingLabel(status: ClientStatus): string {
  return status.replace(/_/g, " ");
}

function formatStageLabel(stage: RelationshipStage | null): string {
  if (!stage) return CRM_UNKNOWN_LABEL;
  return stage.replace(/_/g, " ");
}

function isReviewDue(client: {
  status: ClientStatus;
  next_review_due: string | null;
}): boolean {
  if (client.status === "review_due") return true;
  if (!client.next_review_due) return false;
  const due = new Date(client.next_review_due);
  return !Number.isNaN(due.getTime()) && due < new Date();
}

function reviewStatusLabel(client: {
  status: ClientStatus;
  next_review_due: string | null;
}): string {
  if (isReviewDue(client)) return "Review due";
  if (client.next_review_due) return "Review current";
  return CRM_NOT_ESTABLISHED_LABEL;
}

function maxIsoDate(...dates: Array<string | null | undefined>): string | null {
  const valid = dates
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((date) => date.getTime()))).toISOString();
}

function dataReadinessLabel(completedAt: string | null | undefined): string {
  if (completedAt) return "Discover complete";
  return CRM_NOT_ESTABLISHED_LABEL;
}

function profileCompletenessLabel(completeness: number | null | undefined): string {
  if (completeness == null || !Number.isFinite(completeness)) {
    return CRM_NOT_ESTABLISHED_LABEL;
  }
  return `${Math.round(completeness)}% complete`;
}

export function parseRelationshipListFilters(
  params: URLSearchParams,
): CrmRelationshipListFilters {
  const statusParam = (params.get("status") ?? "all") as ClientStatus | "all";
  const stageParam = (params.get("stage") ?? "all") as RelationshipStage | "all";
  const reviewParam = (params.get("reviewStatus") ?? "all") as "all" | "due" | "current";

  const pageRaw = Number.parseInt(params.get("page") ?? "1", 10);
  const pageSizeRaw = Number.parseInt(params.get("pageSize") ?? "", 10);

  return {
    q: params.get("q")?.trim() || undefined,
    status: VALID_STATUSES.has(statusParam) ? statusParam : "all",
    stage: VALID_STAGES.has(stageParam) ? stageParam : "all",
    reviewStatus:
      reviewParam === "due" || reviewParam === "current" ? reviewParam : "all",
    hasUpcomingAppointment: params.get("hasUpcomingAppointment") === "true",
    needsAttention: params.get("needsAttention") === "true",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    pageSize:
      Number.isInteger(pageSizeRaw) && pageSizeRaw > 0
        ? Math.min(CRM_V2_RELATIONSHIPS_MAX_PAGE_SIZE, pageSizeRaw)
        : CRM_V2_RELATIONSHIPS_DEFAULT_PAGE_SIZE,
  };
}

export async function loadCrmRelationshipListPage(
  authUserId: string,
  userRole: "advisor" | "admin",
  filters: CrmRelationshipListFilters = {},
): Promise<CrmRelationshipListPage> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(
    CRM_V2_RELATIONSHIPS_MAX_PAGE_SIZE,
    Math.max(1, filters.pageSize ?? CRM_V2_RELATIONSHIPS_DEFAULT_PAGE_SIZE),
  );

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  let partialDataWarning = false;

  let countQuery = admin.from("clients").select("id", { count: "exact", head: true });
  let dataQuery = admin
    .from("clients")
    .select(
      "id, display_name, status, relationship_stage, next_review_due, updated_at, advisor_user_id",
    )
    .order("display_name", { ascending: true });

  if (userRole === "advisor") {
    countQuery = countQuery.eq("advisor_user_id", authUserId);
    dataQuery = dataQuery.eq("advisor_user_id", authUserId);
  }

  const search = filters.q?.trim();
  if (search) {
    const pattern = `%${search.replace(/[%_]/g, "")}%`;
    const orFilter = `display_name.ilike.${pattern}`;
    countQuery = countQuery.or(orFilter);
    dataQuery = dataQuery.or(orFilter);
  }

  if (filters.status && filters.status !== "all") {
    countQuery = countQuery.eq("status", filters.status);
    dataQuery = dataQuery.eq("status", filters.status);
  }

  if (filters.stage && filters.stage !== "all") {
    countQuery = countQuery.eq("relationship_stage", filters.stage);
    dataQuery = dataQuery.eq("relationship_stage", filters.stage);
  }

  if (filters.reviewStatus === "due") {
    countQuery = countQuery.or(
      "status.eq.review_due,and(next_review_due.not.is.null,next_review_due.lt." + now + ")",
    );
    dataQuery = dataQuery.or(
      "status.eq.review_due,and(next_review_due.not.is.null,next_review_due.lt." + now + ")",
    );
  } else if (filters.reviewStatus === "current") {
    countQuery = countQuery
      .neq("status", "review_due")
      .not("next_review_due", "is", null)
      .gte("next_review_due", now);
    dataQuery = dataQuery
      .neq("status", "review_due")
      .not("next_review_due", "is", null)
      .gte("next_review_due", now);
  }

  const [{ count, error: countError }, { data: allRows, error: dataError }] =
    await Promise.all([countQuery, dataQuery]);

  if (countError) {
    throw new Error(`Failed to count relationships: ${countError.message}`);
  }
  if (dataError) {
    throw new Error(`Failed to load relationships: ${dataError.message}`);
  }

  const rows = (allRows ?? []) as Array<{
    id: string;
    display_name: string;
    status: ClientStatus;
    relationship_stage: RelationshipStage;
    next_review_due: string | null;
    updated_at: string;
  }>;

  const clientIds = rows.map((row) => row.id);

  const appointmentByClient = new Map<string, string>();
  const lastEngagementByClient = new Map<string, string>();
  const openTasksByClient = new Map<string, number>();
  const discoverByClient = new Map<
    string,
    { completedAt: string | null; completeness: number | null }
  >();

  if (clientIds.length > 0) {
    const [
      appointmentsResult,
      meetingsResult,
      tasksResult,
      discoverResult,
      documentsResult,
    ] = await Promise.all([
      admin
        .from("adviser_appointments")
        .select("client_id, starts_at")
        .in("client_id", clientIds)
        .in("status", ["pending", "confirmed"])
        .gte("starts_at", now)
        .order("starts_at", { ascending: true }),
      admin
        .from("meeting_sessions")
        .select("client_id, completed_at, updated_at, created_at")
        .in("client_id", clientIds)
        .order("updated_at", { ascending: false }),
      admin
        .from("advisor_tasks")
        .select("client_id, status")
        .in("client_id", clientIds)
        .in("status", [...OPEN_TASK_STATUSES]),
      admin
        .from("discover_profiles")
        .select("client_id, completed_at, completeness")
        .in("client_id", clientIds)
        .eq("is_current", true),
      admin
        .from("documents")
        .select("client_id, created_at")
        .in("client_id", clientIds)
        .eq("is_archived", false)
        .order("created_at", { ascending: false }),
    ]);

    if (
      appointmentsResult.error ||
      meetingsResult.error ||
      tasksResult.error ||
      discoverResult.error ||
      documentsResult.error
    ) {
      partialDataWarning = true;
    }

    for (const row of (appointmentsResult.data ?? []) as Array<{
      client_id: string;
      starts_at: string;
    }>) {
      if (!appointmentByClient.has(row.client_id)) {
        appointmentByClient.set(row.client_id, row.starts_at);
      }
    }

    for (const row of (meetingsResult.data ?? []) as Array<{
      client_id: string;
      completed_at: string | null;
      updated_at: string;
      created_at: string;
    }>) {
      const engagement = maxIsoDate(row.completed_at, row.updated_at, row.created_at);
      if (engagement) {
        const existing = lastEngagementByClient.get(row.client_id);
        if (!existing || engagement > existing) {
          lastEngagementByClient.set(row.client_id, engagement);
        }
      }
    }

    for (const row of (documentsResult.data ?? []) as Array<{
      client_id: string;
      created_at: string;
    }>) {
      const existing = lastEngagementByClient.get(row.client_id);
      if (!existing || row.created_at > existing) {
        lastEngagementByClient.set(row.client_id, row.created_at);
      }
    }

    for (const row of (tasksResult.data ?? []) as Array<{
      client_id: string | null;
      status: string;
    }>) {
      if (!row.client_id) continue;
      openTasksByClient.set(
        row.client_id,
        (openTasksByClient.get(row.client_id) ?? 0) + 1,
      );
    }

    for (const row of (discoverResult.data ?? []) as Array<{
      client_id: string;
      completed_at: string | null;
      completeness: number | string | null;
    }>) {
      const completeness =
        row.completeness == null
          ? null
          : typeof row.completeness === "number"
            ? row.completeness
            : Number(row.completeness);
      discoverByClient.set(row.client_id, {
        completedAt: row.completed_at,
        completeness: Number.isFinite(completeness) ? completeness : null,
      });
    }
  }

  let filteredRows = rows.map((client) => {
    const discover = discoverByClient.get(client.id);
    const lastEngagement = maxIsoDate(
      lastEngagementByClient.get(client.id),
      client.updated_at,
      discover?.completedAt,
    );
    const nextAppointment = appointmentByClient.get(client.id) ?? null;
    const openCount = openTasksByClient.get(client.id) ?? 0;

    return {
      client,
      lastEngagement,
      nextAppointment,
      openCount,
      discover,
      reviewDue: isReviewDue(client),
    };
  });

  if (filters.hasUpcomingAppointment) {
    filteredRows = filteredRows.filter((row) => row.nextAppointment != null);
  }

  if (filters.needsAttention) {
    filteredRows = filteredRows.filter(
      (row) => row.reviewDue || row.openCount > 0,
    );
  }

  const totalCount = filters.hasUpcomingAppointment || filters.needsAttention
    ? filteredRows.length
    : (count ?? 0);
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;
  const from = (page - 1) * pageSize;
  const pageRows = filteredRows.slice(from, from + pageSize);

  const relationships: CrmRelationshipListItem[] = pageRows.map(
    ({ client, lastEngagement, nextAppointment, openCount, discover }) => {
      const lastLabel = lastEngagement
        ? new Date(lastEngagement).toLocaleDateString("en-SG", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : CRM_UNKNOWN_LABEL;

      const nextLabel = nextAppointment
        ? new Date(nextAppointment).toLocaleDateString("en-SG", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : CRM_NOT_SCHEDULED_LABEL;

      return {
        relationshipId: client.id,
        clientId: client.id,
        displayName: client.display_name,
        servicingState: client.status,
        servicingStateLabel: formatServicingLabel(client.status),
        relationshipStage: client.relationship_stage,
        relationshipStageLabel: formatStageLabel(client.relationship_stage),
        lastEngagementAt: lastEngagement,
        lastEngagementLabel: lastLabel,
        nextAppointmentAt: nextAppointment,
        nextAppointmentLabel: nextLabel,
        reviewStatusLabel: reviewStatusLabel(client),
        openActionsCount: partialDataWarning && clientIds.length > 0 ? null : openCount,
        openActionsLabel:
          partialDataWarning && clientIds.length > 0
            ? CRM_UNKNOWN_LABEL
            : String(openCount),
        dataReadinessLabel: dataReadinessLabel(discover?.completedAt),
        profileCompletenessLabel: profileCompletenessLabel(discover?.completeness),
        detailHref: buildRelationshipDetailHref(client.id),
      };
    },
  );

  return {
    relationships,
    page,
    pageSize,
    totalCount,
    totalPages,
    partialDataWarning,
  };
}
