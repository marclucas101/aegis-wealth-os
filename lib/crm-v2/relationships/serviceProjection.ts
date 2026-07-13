import "server-only";

import {
  buildLegacyMeetingStudioHref,
  buildLegacyTasksHref,
  isAllowlistedRelationshipLink,
} from "@/lib/crm-v2/relationships/routes";
import type { CrmServiceItem } from "@/lib/crm-v2/relationships/types";
import {
  CRM_NOT_SCHEDULED_LABEL,
  CRM_UNKNOWN_LABEL,
} from "@/lib/crm-v2/relationships/types";
import { CRM_V2_SERVICE_MAX_ITEMS } from "@/lib/crm-v2/constants";
import { CRM_V2_SERVICE_PATH } from "@/lib/crm-v2/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const OPEN_TASK_STATUSES = ["open", "in_progress"] as const;
const ACTIVE_ROADMAP_STATUSES = ["not_started", "in_progress"] as const;

function formatDueLabel(dueDate: string | null): string {
  if (!dueDate) return CRM_NOT_SCHEDULED_LABEL;
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return CRM_UNKNOWN_LABEL;
  return parsed.toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function loadCrmServiceProjection(
  clientId: string,
): Promise<{ items: CrmServiceItem[]; bounded: boolean }> {
  const admin = createAdminSupabaseClient();

  const [tasksResult, roadmapResult, reviewResult, commitmentsResult, requestsResult] =
    await Promise.all([
    admin
      .from("advisor_tasks")
      .select("id, title, status, due_date, task_type, assigned_to_user_id")
      .eq("client_id", clientId)
      .in("status", [...OPEN_TASK_STATUSES])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(CRM_V2_SERVICE_MAX_ITEMS + 1),
    admin
      .from("roadmap_items")
      .select("id, title, status, priority")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .in("status", [...ACTIVE_ROADMAP_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(CRM_V2_SERVICE_MAX_ITEMS + 1),
    admin
      .from("annual_reviews")
      .select("id, review_year, generated_at")
      .eq("client_id", clientId)
      .order("generated_at", { ascending: false })
      .limit(3),
    admin
      .from("service_commitments")
      .select("id, title, lifecycle_status, due_at, owner, commitment_type")
      .eq("client_id", clientId)
      .not("lifecycle_status", "in", "(completed,cancelled)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(CRM_V2_SERVICE_MAX_ITEMS + 1),
    admin
      .from("client_service_requests")
      .select("id, summary, lifecycle_status, created_at, request_category")
      .eq("client_id", clientId)
      .not("lifecycle_status", "in", "(resolved,closed,cancelled)")
      .order("created_at", { ascending: false })
      .limit(CRM_V2_SERVICE_MAX_ITEMS + 1),
  ]);

  const items: CrmServiceItem[] = [];

  for (const row of (tasksResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    task_type: string;
  }>) {
    const href = buildLegacyTasksHref(clientId);
    if (!isAllowlistedRelationshipLink(href)) continue;
    items.push({
      itemId: `advisor_task:${row.id}`,
      source: "Adviser task",
      ownerLabel: CRM_UNKNOWN_LABEL,
      statusLabel: row.status.replace(/_/g, " "),
      dueDate: row.due_date,
      dueDateLabel: formatDueLabel(row.due_date),
      summary: row.title,
      workflowHref: href,
    });
  }

  for (const row of (roadmapResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>) {
    items.push({
      itemId: `roadmap_item:${row.id}`,
      source: "Roadmap action",
      ownerLabel: CRM_UNKNOWN_LABEL,
      statusLabel: row.status.replace(/_/g, " "),
      dueDate: null,
      dueDateLabel: CRM_NOT_SCHEDULED_LABEL,
      summary: row.title,
      workflowHref: `/advisor/clients/${clientId}/roadmap`,
    });
  }

  for (const row of (reviewResult.data ?? []) as Array<{
    id: string;
    review_year: number;
    generated_at: string;
  }>) {
    items.push({
      itemId: `annual_review:${row.id}`,
      source: "Annual review",
      ownerLabel: CRM_UNKNOWN_LABEL,
      statusLabel: "On file",
      dueDate: row.generated_at,
      dueDateLabel: formatDueLabel(row.generated_at),
      summary: `Annual review ${row.review_year}`,
      workflowHref: buildLegacyMeetingStudioHref(clientId),
    });
  }

  for (const row of (commitmentsResult.data ?? []) as Array<{
    id: string;
    title: string;
    lifecycle_status: string;
    due_at: string | null;
    owner: string;
    commitment_type: string;
  }>) {
    items.push({
      itemId: `service_commitment:${row.id}`,
      source: "Commitment",
      ownerLabel: row.owner.replace(/_/g, " "),
      statusLabel: row.lifecycle_status.replace(/_/g, " "),
      dueDate: row.due_at,
      dueDateLabel: formatDueLabel(row.due_at),
      summary: row.title,
      workflowHref: `${CRM_V2_SERVICE_PATH}?view=commitments`,
    });
  }

  for (const row of (requestsResult.data ?? []) as Array<{
    id: string;
    summary: string;
    lifecycle_status: string;
    created_at: string;
    request_category: string;
  }>) {
    items.push({
      itemId: `client_service_request:${row.id}`,
      source: "Client request",
      ownerLabel: "Client",
      statusLabel: row.lifecycle_status.replace(/_/g, " "),
      dueDate: row.created_at,
      dueDateLabel: formatDueLabel(row.created_at),
      summary: row.summary,
      workflowHref: `${CRM_V2_SERVICE_PATH}?view=client_requests`,
    });
  }

  items.sort((a, b) => {
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  const bounded = items.length > CRM_V2_SERVICE_MAX_ITEMS;
  return {
    items: items.slice(0, CRM_V2_SERVICE_MAX_ITEMS),
    bounded,
  };
}

export const CRM_SERVICE_PHASE_NOTICE =
  "Phase 06: service commitments and client requests project from canonical CRM V2 authorities.";
