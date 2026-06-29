import "server-only";

import { toRelationshipIdentity } from "@/lib/crm-v2/relationships/identity";
import { loadCrmDocumentProjection } from "@/lib/crm-v2/relationships/documentProjection";
import {
  buildLegacyClientHref,
  buildLegacyDiscoverHref,
  buildLegacyDocumentVaultHref,
  buildLegacyMeetingStudioHref,
  buildLegacyPlanningOutputsHref,
  buildLegacyRoadmapHref,
  buildLegacyTasksHref,
  buildRelationshipListHref,
  type CrmV2RelationshipTab,
} from "@/lib/crm-v2/relationships/routes";
import {
  CRM_SERVICE_PHASE_NOTICE,
  loadCrmServiceProjection,
} from "@/lib/crm-v2/relationships/serviceProjection";
import { loadCrmTimelineProjection } from "@/lib/crm-v2/relationships/timelineProjection";
import type {
  CrmFinancialPlanLink,
  CrmOverviewPanel,
  CrmRelationship360,
  CrmRelationshipHeader,
  CrmRelationshipProfileField,
} from "@/lib/crm-v2/relationships/types";
import {
  CRM_NOT_ESTABLISHED_LABEL,
  CRM_NOT_SCHEDULED_LABEL,
  CRM_UNKNOWN_LABEL,
} from "@/lib/crm-v2/relationships/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppClientRow } from "@/lib/supabase/userProfile";

const OPEN_TASK_STATUSES = ["open", "in_progress"] as const;

function isReviewDue(client: AppClientRow): boolean {
  if (client.status === "review_due") return true;
  if (!client.next_review_due) return false;
  const due = new Date(client.next_review_due);
  return !Number.isNaN(due.getTime()) && due < new Date();
}

function formatDateLabel(value: string | null): string {
  if (!value) return CRM_UNKNOWN_LABEL;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return CRM_UNKNOWN_LABEL;
  return parsed.toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatServicingLabel(status: AppClientRow["status"]): string {
  return status.replace(/_/g, " ");
}

function formatStageLabel(stage: AppClientRow["relationship_stage"]): string {
  return stage.replace(/_/g, " ");
}

async function loadSupplementaryContext(
  clientId: string,
  advisorUserId: string | null,
): Promise<{
  nextAppointmentAt: string | null;
  lastEngagementAt: string | null;
  openActionsCount: number;
  discoverCompletedAt: string | null;
  discoverCompleteness: number | null;
  roadmapOpenCount: number;
  latestPublishedAt: string | null;
  latestBinderPublished: boolean;
  adviserName: string | null;
  warnings: string[];
}> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const warnings: string[] = [];

  const [
    appointmentsResult,
    meetingsResult,
    tasksResult,
    discoverResult,
    roadmapResult,
    outputsResult,
    bindersResult,
    documentsResult,
    adviserResult,
  ] = await Promise.all([
    admin
      .from("adviser_appointments")
      .select("starts_at")
      .eq("client_id", clientId)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from("meeting_sessions")
      .select("completed_at, updated_at, created_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("advisor_tasks")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .in("status", [...OPEN_TASK_STATUSES]),
    admin
      .from("discover_profiles")
      .select("completed_at, completeness")
      .eq("client_id", clientId)
      .eq("is_current", true)
      .maybeSingle(),
    admin
      .from("roadmap_items")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_active", true)
      .in("status", ["not_started", "in_progress"]),
    admin
      .from("published_outputs")
      .select("published_at")
      .eq("client_id", clientId)
      .eq("publication_status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("binder_exports")
      .select("published_at, published_to_client")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("documents")
      .select("created_at")
      .eq("client_id", clientId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    advisorUserId
      ? admin
          .from("users")
          .select("full_name")
          .eq("id", advisorUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (appointmentsResult.error) warnings.push("appointments_unavailable");
  if (meetingsResult.error) warnings.push("meetings_unavailable");
  if (tasksResult.error) warnings.push("tasks_unavailable");
  if (discoverResult.error) warnings.push("discover_unavailable");

  const meetingRow = meetingsResult.data as {
    completed_at: string | null;
    updated_at: string;
    created_at: string;
  } | null;
  const documentRow = documentsResult.data as { created_at: string } | null;
  const discoverRow = discoverResult.data as {
    completed_at: string | null;
    completeness: number | string | null;
  } | null;

  const engagementDates = [
    meetingRow?.completed_at,
    meetingRow?.updated_at,
    meetingRow?.created_at,
    documentRow?.created_at,
  ].filter((value): value is string => Boolean(value));

  const lastEngagementAt =
    engagementDates.length > 0
      ? engagementDates.reduce((latest, current) =>
          current > latest ? current : latest,
        )
      : null;

  const completenessRaw = discoverRow?.completeness;
  const completeness =
    completenessRaw == null
      ? null
      : typeof completenessRaw === "number"
        ? completenessRaw
        : Number(completenessRaw);

  return {
    nextAppointmentAt:
      (appointmentsResult.data as { starts_at: string } | null)?.starts_at ?? null,
    lastEngagementAt,
    openActionsCount: tasksResult.count ?? 0,
    discoverCompletedAt: discoverRow?.completed_at ?? null,
    discoverCompleteness: Number.isFinite(completeness) ? completeness : null,
    roadmapOpenCount: roadmapResult.count ?? 0,
    latestPublishedAt:
      (outputsResult.data as { published_at: string | null } | null)?.published_at ?? null,
    latestBinderPublished:
      (bindersResult.data as { published_to_client: boolean } | null)?.published_to_client ??
      false,
    adviserName:
      (adviserResult.data as { full_name: string | null } | null)?.full_name ?? null,
    warnings,
  };
}

function buildHeader(
  client: AppClientRow,
  context: Awaited<ReturnType<typeof loadSupplementaryContext>>,
  adviserName: string | null,
): CrmRelationshipHeader {
  return {
    displayName: client.display_name,
    servicingStateLabel: formatServicingLabel(client.status),
    relationshipStageLabel: formatStageLabel(client.relationship_stage),
    adviserAssignmentLabel: adviserName?.trim() || CRM_UNKNOWN_LABEL,
    lastEngagementAt: context.lastEngagementAt,
    lastEngagementLabel: formatDateLabel(context.lastEngagementAt),
    nextAppointmentAt: context.nextAppointmentAt,
    nextAppointmentLabel: context.nextAppointmentAt
      ? formatDateLabel(context.nextAppointmentAt)
      : CRM_NOT_SCHEDULED_LABEL,
    reviewStatusLabel: isReviewDue(client)
      ? "Review due"
      : client.next_review_due
        ? "Review current"
        : CRM_NOT_ESTABLISHED_LABEL,
    openActionsCount: context.openActionsCount,
    openActionsLabel: String(context.openActionsCount),
    dataFreshnessLabel: context.discoverCompletedAt
      ? `Discover updated ${formatDateLabel(context.discoverCompletedAt)}`
      : CRM_NOT_ESTABLISHED_LABEL,
    listHref: buildRelationshipListHref(),
  };
}

function buildOverviewPanels(
  client: AppClientRow,
  context: Awaited<ReturnType<typeof loadSupplementaryContext>>,
): CrmOverviewPanel[] {
  return [
    {
      panelId: "relationship_status",
      title: "Relationship status",
      value: `${formatServicingLabel(client.status)} — ${formatStageLabel(client.relationship_stage)}`,
      detailHref: buildLegacyClientHref(client.id, "overview"),
    },
    {
      panelId: "planning_stage",
      title: "Planning stage",
      value: context.discoverCompletedAt ? "Discover complete" : CRM_NOT_ESTABLISHED_LABEL,
      detailHref: buildLegacyDiscoverHref(client.id),
    },
    {
      panelId: "next_appointment",
      title: "Next appointment",
      value: context.nextAppointmentAt
        ? formatDateLabel(context.nextAppointmentAt)
        : CRM_NOT_SCHEDULED_LABEL,
      detailHref: "/advisor/appointments",
    },
    {
      panelId: "review_readiness",
      title: "Review readiness",
      value: isReviewDue(client) ? "Review due" : client.next_review_due ? "Review current" : CRM_NOT_ESTABLISHED_LABEL,
      detailHref: buildLegacyClientHref(client.id, "reviews"),
    },
    {
      panelId: "open_tasks",
      title: "Open adviser tasks",
      value: String(context.openActionsCount),
      detailHref: buildLegacyTasksHref(client.id),
    },
    {
      panelId: "roadmap_status",
      title: "Roadmap actions",
      value:
        context.roadmapOpenCount > 0
          ? `${context.roadmapOpenCount} open`
          : CRM_NOT_ESTABLISHED_LABEL,
      detailHref: buildLegacyRoadmapHref(client.id),
    },
    {
      panelId: "recent_engagement",
      title: "Recent engagement",
      value: formatDateLabel(context.lastEngagementAt),
      detailHref: buildLegacyMeetingStudioHref(client.id),
    },
    {
      panelId: "data_completeness",
      title: "Data completeness",
      value:
        context.discoverCompleteness != null
          ? `${Math.round(context.discoverCompleteness)}% complete`
          : CRM_NOT_ESTABLISHED_LABEL,
      detailHref: buildLegacyDiscoverHref(client.id),
    },
    {
      panelId: "latest_output",
      title: "Latest published output",
      value: context.latestPublishedAt
        ? formatDateLabel(context.latestPublishedAt)
        : CRM_NOT_ESTABLISHED_LABEL,
      detailHref: buildLegacyPlanningOutputsHref(client.id),
    },
    {
      panelId: "binder_availability",
      title: "Meeting pack / binder",
      value: context.latestBinderPublished
        ? "Published to client"
        : CRM_NOT_ESTABLISHED_LABEL,
      detailHref: buildLegacyDocumentVaultHref(client.id),
    },
  ];
}

function buildFinancialPlanLinks(
  clientId: string,
  context: Awaited<ReturnType<typeof loadSupplementaryContext>>,
): CrmFinancialPlanLink[] {
  return [
    {
      label: "Discover / fact-find",
      href: buildLegacyDiscoverHref(clientId),
      statusLabel: context.discoverCompletedAt ? "Complete" : CRM_NOT_ESTABLISHED_LABEL,
    },
    {
      label: "Shield diagnostic",
      href: buildLegacyClientHref(clientId, "diagnostics"),
      statusLabel: CRM_UNKNOWN_LABEL,
    },
    {
      label: "Goals and planning outputs",
      href: buildLegacyPlanningOutputsHref(clientId),
      statusLabel: context.latestPublishedAt ? "Published output on file" : CRM_NOT_ESTABLISHED_LABEL,
    },
    {
      label: "Wealth roadmap",
      href: buildLegacyRoadmapHref(clientId),
      statusLabel:
        context.roadmapOpenCount > 0
          ? `${context.roadmapOpenCount} open actions`
          : CRM_NOT_ESTABLISHED_LABEL,
    },
    {
      label: "Protection report",
      href: buildLegacyClientHref(clientId, "protection"),
      statusLabel: CRM_UNKNOWN_LABEL,
    },
    {
      label: "Meeting studio",
      href: buildLegacyMeetingStudioHref(clientId),
      statusLabel: CRM_UNKNOWN_LABEL,
    },
    {
      label: "Document vault / binders",
      href: buildLegacyDocumentVaultHref(clientId),
      statusLabel: context.latestBinderPublished ? "Binder published" : CRM_NOT_ESTABLISHED_LABEL,
    },
  ];
}

function buildProfileFields(client: AppClientRow): CrmRelationshipProfileField[] {
  return [
    { label: "Display name", value: client.display_name },
    {
      label: "Preferred contact email",
      value: client.email?.trim() || CRM_NOT_ESTABLISHED_LABEL,
    },
    {
      label: "Phone",
      value: client.phone?.trim() || CRM_NOT_ESTABLISHED_LABEL,
    },
    {
      label: "Servicing state",
      value: formatServicingLabel(client.status),
    },
    {
      label: "Relationship stage",
      value: formatStageLabel(client.relationship_stage),
    },
    {
      label: "Onboarding step",
      value: client.onboarding_step?.replace(/_/g, " ") || CRM_NOT_ESTABLISHED_LABEL,
    },
    {
      label: "Last review",
      value: formatDateLabel(client.last_review_at),
    },
    {
      label: "Next review due",
      value: client.next_review_due
        ? formatDateLabel(client.next_review_due)
        : CRM_NOT_SCHEDULED_LABEL,
    },
    {
      label: "Important dates",
      value: "Relationship Moments — Phase 08",
    },
    {
      label: "Availability",
      value: "Availability periods — deferred",
    },
    {
      label: "Referral context",
      value: CRM_NOT_ESTABLISHED_LABEL,
    },
  ];
}

export async function loadCrmRelationship360(
  client: AppClientRow,
  activeTab: CrmV2RelationshipTab,
  requestId: string,
): Promise<CrmRelationship360> {
  const started = Date.now();
  const identity = toRelationshipIdentity(client);
  const context = await loadSupplementaryContext(client.id, client.advisor_user_id);
  const warnings: string[] = [...context.warnings];

  const [timelineResult, serviceResult, documentsResult] = await Promise.all([
    loadCrmTimelineProjection(client.id).catch(() => {
      warnings.push("timeline_unavailable");
      return { timeline: [], bounded: false };
    }),
    loadCrmServiceProjection(client.id).catch(() => {
      warnings.push("service_unavailable");
      return { items: [], bounded: false };
    }),
    loadCrmDocumentProjection(client.id).catch(() => {
      warnings.push("documents_unavailable");
      return {
        items: [],
        bounded: false,
        vaultHref: buildLegacyDocumentVaultHref(client.id),
      };
    }),
  ]);

  const header = buildHeader(client, context, context.adviserName);

  return {
    identity,
    header,
    activeTab,
    overview: {
      panels: buildOverviewPanels(client, context),
      protectionNotice:
        "Structured protection portfolio will be introduced in Phase 07.",
    },
    financialPlan: {
      links: buildFinancialPlanLinks(client.id, context),
    },
    engagement: timelineResult,
    service: {
      items: serviceResult.items,
      phaseNotice: CRM_SERVICE_PHASE_NOTICE,
      bounded: serviceResult.bounded,
    },
    documents: {
      items: documentsResult.items,
      vaultHref: documentsResult.vaultHref,
      bounded: documentsResult.bounded,
    },
    profile: {
      fields: buildProfileFields(client),
      futurePhaseNotices: [
        "Relationship Moments — Phase 08",
        "Advocacy tracking — Phase 09",
        "Household grouping — deferred per blueprint",
      ],
    },
    diagnostics: {
      requestId,
      loadedAt: new Date().toISOString(),
      sourceWarnings: warnings,
      timingMs: Date.now() - started,
    },
  };
}
