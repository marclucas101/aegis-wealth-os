import "server-only";

import {
  buildLegacyMeetingStudioHref,
  buildRelationshipDetailHref,
} from "@/lib/crm-v2/relationships/routes";
import { buildAppointmentDetailHref } from "@/lib/crm-v2/appointments/routes";
import { CRM_V2_SERVICE_PATH } from "@/lib/crm-v2/navigation";
import type { CrmServiceMyWorkItem, CrmServiceWorkspaceView } from "@/lib/crm-v2/service/types";
import { CRM_V2_SERVICE_MAX_ITEMS } from "@/lib/crm-v2/constants";
import { listAdviserCommitments, listAdviserServiceRequests } from "@/lib/crm-v2/service/service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  buildAdvisorReviewPipelineFromContexts,
  loadAdvisorClientReviewContexts,
} from "@/lib/supabase/advisorReviewPipeline";
import { loadAdvisorAccessibleClients } from "@/lib/supabase/clientFileQuality";

const OPEN_TASK_STATUSES = ["open", "in_progress"] as const;

export function parseServiceWorkspaceView(
  value: string | null | undefined,
): CrmServiceWorkspaceView {
  const allowed: CrmServiceWorkspaceView[] = [
    "my_work",
    "client_requests",
    "reviews",
    "commitments",
    "documents_required",
    "workflow_cases",
    "completed",
  ];
  if (value && (allowed as string[]).includes(value)) {
    return value as CrmServiceWorkspaceView;
  }
  return "my_work";
}

export async function loadServiceWorkspaceMyWork(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
}): Promise<{ items: CrmServiceMyWorkItem[]; bounded: boolean }> {
  const admin = createAdminSupabaseClient();
  const [commitments, requests, tasksResult, followUpResult] = await Promise.all([
    listAdviserCommitments({ ...input, openOnly: true }),
    listAdviserServiceRequests({ ...input, openOnly: true }),
    admin
      .from("advisor_tasks")
      .select("id, client_id, title, status, due_date, clients(display_name)")
      .in("status", [...OPEN_TASK_STATUSES])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(CRM_V2_SERVICE_MAX_ITEMS + 1),
    admin
      .from("adviser_appointments")
      .select("id, client_id, title, follow_up_state, starts_at, clients(display_name)")
      .eq("follow_up_state", "required")
      .order("starts_at", { ascending: false })
      .limit(CRM_V2_SERVICE_MAX_ITEMS + 1),
  ]);

  const items: CrmServiceMyWorkItem[] = [];

  for (const c of commitments) {
    items.push({
      itemId: `commitment:${c.commitmentId}`,
      source: "Commitment",
      relationshipId: c.relationshipId,
      relationshipDisplayName: c.relationshipDisplayName,
      summary: c.title,
      statusLabel: c.lifecycleLabel,
      dueAt: c.dueAt,
      workflowHref: `${CRM_V2_SERVICE_PATH}?view=commitments`,
    });
  }

  for (const r of requests) {
    items.push({
      itemId: `request:${r.requestId}`,
      source: "Client request",
      relationshipId: r.relationshipId,
      relationshipDisplayName: r.relationshipDisplayName,
      summary: r.summary,
      statusLabel: r.clientVisibleStatus,
      dueAt: null,
      workflowHref: `${CRM_V2_SERVICE_PATH}?view=client_requests`,
    });
  }

  for (const row of (tasksResult.data ?? []) as Array<Record<string, unknown>>) {
    const clientId = String(row.client_id);
    const client = row.clients as { display_name: string } | null;
    items.push({
      itemId: `advisor_task:${String(row.id)}`,
      source: "Adviser task",
      relationshipId: clientId,
      relationshipDisplayName: client?.display_name ?? null,
      summary: String(row.title),
      statusLabel: String(row.status).replace(/_/g, " "),
      dueAt: (row.due_date as string | null) ?? null,
      workflowHref: `/advisor/clients/${clientId}?tab=overview`,
    });
  }

  for (const row of (followUpResult.data ?? []) as Array<Record<string, unknown>>) {
    const clientId = String(row.client_id);
    const client = row.clients as { display_name: string } | null;
    items.push({
      itemId: `appointment_follow_up:${String(row.id)}`,
      source: "Appointment follow-up",
      relationshipId: clientId,
      relationshipDisplayName: client?.display_name ?? null,
      summary: String(row.title ?? "Follow-up required"),
      statusLabel: "Follow-up required",
      dueAt: (row.starts_at as string | null) ?? null,
      workflowHref: buildAppointmentDetailHref(String(row.id)),
    });
  }

  items.sort((a, b) => {
    const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  const bounded = items.length > CRM_V2_SERVICE_MAX_ITEMS;
  return { items: items.slice(0, CRM_V2_SERVICE_MAX_ITEMS), bounded };
}

export async function loadServiceWorkspaceReviews(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
}): Promise<CrmServiceMyWorkItem[]> {
  const clients = await loadAdvisorAccessibleClients(input.authUserId, input.userRole);
  const contexts = await loadAdvisorClientReviewContexts(clients);
  const pipeline = buildAdvisorReviewPipelineFromContexts(contexts);
  const reviewClients = [
    ...pipeline.overdue,
    ...pipeline.dueThisMonth,
    ...pipeline.highPriority,
  ];

  return reviewClients
    .slice(0, CRM_V2_SERVICE_MAX_ITEMS)
    .map((c) => ({
      itemId: `review_due:${c.clientId}`,
      source: "Review due",
      relationshipId: c.clientId,
      relationshipDisplayName: c.displayName,
      summary: c.servicingState === "overdue" ? "Review overdue" : "Review due",
      statusLabel: c.servicingState.replace(/_/g, " "),
      dueAt: c.nextRecommendedReviewDate,
      workflowHref: buildLegacyMeetingStudioHref(c.clientId),
    }));
}

export async function loadServiceWorkspaceDocumentRequests(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
}): Promise<CrmServiceMyWorkItem[]> {
  const commitments = await listAdviserCommitments({ ...input, openOnly: true });
  return commitments
    .filter((c) => c.commitmentType === "document_request")
    .map((c) => ({
      itemId: `document_request:${c.commitmentId}`,
      source: "Document required",
      relationshipId: c.relationshipId,
      relationshipDisplayName: c.relationshipDisplayName,
      summary: c.title,
      statusLabel: c.lifecycleLabel,
      dueAt: c.dueAt,
      workflowHref: buildRelationshipDetailHref(c.relationshipId, "documents"),
    }));
}

export async function loadServiceWorkspaceCompleted(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
}): Promise<CrmServiceMyWorkItem[]> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("service_commitments")
    .select("id, client_id, title, lifecycle_status, completed_at, clients(display_name)")
    .eq("lifecycle_status", "completed")
    .order("completed_at", { ascending: false })
    .limit(CRM_V2_SERVICE_MAX_ITEMS);

  if (input.userRole === "advisor") {
    query = query.eq("adviser_user_id", input.authUserId);
  }

  const { data } = await query;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const client = row.clients as { display_name: string } | null;
    return {
      itemId: `commitment_completed:${String(row.id)}`,
      source: "Completed commitment",
      relationshipId: String(row.client_id),
      relationshipDisplayName: client?.display_name ?? null,
      summary: String(row.title),
      statusLabel: "Completed",
      dueAt: (row.completed_at as string | null) ?? null,
      workflowHref: `${CRM_V2_SERVICE_PATH}?view=commitments`,
    };
  });
}
