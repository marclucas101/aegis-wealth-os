import "server-only";

import {
  CRM_V2_APPOINTMENTS_DEFAULT_PAGE_SIZE,
  CRM_V2_APPOINTMENTS_LIST_DAYS_AGENDA,
  CRM_V2_APPOINTMENTS_LIST_DAYS_HISTORY,
  CRM_V2_APPOINTMENTS_MAX_PAGE_SIZE,
} from "@/lib/crm-v2/constants";
import { resolveEffectiveLifecycleStatus } from "@/lib/crm-v2/appointments/legacyMapping";
import {
  deriveAdviserActions,
  lifecycleStatusLabel,
  type CrmAppointmentLifecycleStatus,
} from "@/lib/crm-v2/appointments/lifecycle";
import {
  buildAppointmentDetailHref,
  parseAppointmentListView,
} from "@/lib/crm-v2/appointments/routes";
import { getAppointmentTemplate } from "@/lib/crm-v2/appointments/templates";
import type {
  CrmAppointmentListItem,
  CrmAppointmentListPage,
  CrmAppointmentListView,
} from "@/lib/crm-v2/appointments/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CalendarLocationType } from "@/lib/aegis/calendar";

type AppointmentRow = {
  id: string;
  adviser_user_id: string;
  client_id: string;
  appointment_type: string;
  template_key: string | null;
  title: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  crm_lifecycle_status: string | null;
  location_type: CalendarLocationType;
  location_text: string | null;
  preparation_state: "not_started" | "in_progress" | "complete";
  follow_up_state: "none" | "required" | "complete";
};

export type CrmAppointmentListFilters = {
  view?: CrmAppointmentListView;
  q?: string;
  page?: number;
  pageSize?: number;
  now: string;
};

function locationSummary(row: AppointmentRow): string {
  switch (row.location_type) {
    case "physical":
      return row.location_text?.trim() || "In person";
    case "phone":
      return "Phone";
    case "google_meet":
      return "Video call";
    default:
      return "Meeting";
  }
}

function viewLifecycleFilter(
  view: CrmAppointmentListView,
): CrmAppointmentLifecycleStatus[] | null {
  switch (view) {
    case "requests":
      return ["requested", "proposed", "awaiting_confirmation"];
    case "preparation":
      return ["preparing", "ready"];
    case "follow_up":
      return ["follow_up_required"];
    case "history":
      return [
        "closed",
        "cancelled_by_client",
        "cancelled_by_adviser",
        "no_show",
        "legacy_cancelled",
        "legacy_failed",
      ];
    case "upcoming":
      return [
        "confirmed",
        "preparing",
        "ready",
        "rescheduled",
        "awaiting_confirmation",
        "proposed",
      ];
    case "agenda":
    default:
      return null;
  }
}

export function parseAppointmentListFilters(
  params: URLSearchParams,
  now: string,
): CrmAppointmentListFilters {
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    CRM_V2_APPOINTMENTS_MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.parseInt(
        params.get("pageSize") ?? String(CRM_V2_APPOINTMENTS_DEFAULT_PAGE_SIZE),
        10,
      ) || CRM_V2_APPOINTMENTS_DEFAULT_PAGE_SIZE,
    ),
  );

  return {
    view: parseAppointmentListView(params.get("view")),
    q: params.get("q")?.trim() || undefined,
    page,
    pageSize,
    now,
  };
}

export async function loadCrmAppointmentListPage(
  authUserId: string,
  userRole: "advisor" | "admin",
  filters: CrmAppointmentListFilters,
): Promise<CrmAppointmentListPage> {
  const admin = createAdminSupabaseClient();
  const view = filters.view ?? "agenda";
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? CRM_V2_APPOINTMENTS_DEFAULT_PAGE_SIZE;
  const now = new Date(filters.now);

  let rangeStart: string | undefined;
  let rangeEnd: string | undefined;

  if (view === "agenda") {
    rangeStart = now.toISOString();
    const end = new Date(now);
    end.setDate(end.getDate() + CRM_V2_APPOINTMENTS_LIST_DAYS_AGENDA);
    rangeEnd = end.toISOString();
  } else if (view === "upcoming") {
    rangeStart = now.toISOString();
  } else if (view === "history") {
    const start = new Date(now);
    start.setDate(start.getDate() - CRM_V2_APPOINTMENTS_LIST_DAYS_HISTORY);
    rangeStart = start.toISOString();
    rangeEnd = now.toISOString();
  }

  let query = admin
    .from("adviser_appointments")
    .select(
      "id, adviser_user_id, client_id, appointment_type, template_key, title, starts_at, ends_at, timezone, status, crm_lifecycle_status, location_type, location_text, preparation_state, follow_up_state",
      { count: "exact" },
    );

  if (userRole === "advisor") {
    query = query.eq("adviser_user_id", authUserId);
  }

  if (rangeStart && view !== "history") {
    query = query.gte("starts_at", rangeStart);
  }
  if (rangeEnd) {
    query = query.lte("starts_at", rangeEnd);
  }
  if (view === "history" && rangeStart) {
    query = query.gte("starts_at", rangeStart);
  }

  const lifecycleFilter = viewLifecycleFilter(view);
  if (lifecycleFilter) {
    query = query.in("crm_lifecycle_status", lifecycleFilter);
  }

  const ascending = view === "history";
  query = query
    .order("starts_at", { ascending })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error("Failed to load appointments");
  }

  const rows = (data ?? []) as AppointmentRow[];
  const clientIds = [...new Set(rows.map((row) => row.client_id))];
  const clientsById = new Map<string, string>();

  if (clientIds.length > 0) {
    let clientQuery = admin.from("clients").select("id, display_name").in("id", clientIds);
    if (userRole === "advisor") {
      clientQuery = clientQuery.eq("advisor_user_id", authUserId);
    }
    const { data: clients } = await clientQuery;
    for (const client of (clients ?? []) as Array<{ id: string; display_name: string }>) {
      clientsById.set(client.id, client.display_name);
    }
  }

  const search = filters.q?.toLowerCase();

  let appointments: CrmAppointmentListItem[] = rows
    .map((row) => {
      const lifecycleStatus = resolveEffectiveLifecycleStatus({
        crmLifecycleStatus: row.crm_lifecycle_status,
        legacyStatus: row.status,
      });

      if (lifecycleFilter && row.crm_lifecycle_status) {
        if (!lifecycleFilter.includes(lifecycleStatus)) {
          return null;
        }
      } else if (lifecycleFilter && !row.crm_lifecycle_status) {
        if (!lifecycleFilter.includes(lifecycleStatus)) {
          return null;
        }
      }

      const template = row.template_key ? getAppointmentTemplate(row.template_key) : null;
      const clientDisplayName = clientsById.get(row.client_id) ?? "Relationship";

      return {
        appointmentId: row.id,
        relationshipId: row.client_id,
        clientDisplayName,
        templateKey: template?.key ?? null,
        templateLabel: template?.displayName ?? row.appointment_type,
        title: row.title,
        lifecycleStatus,
        lifecycleLabel: lifecycleStatusLabel(lifecycleStatus),
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        timezone: row.timezone,
        deliveryMode: row.location_type,
        locationSummary: locationSummary(row),
        preparationState: row.preparation_state ?? "not_started",
        followUpState: row.follow_up_state ?? "none",
        allowedActions: deriveAdviserActions(lifecycleStatus),
        detailHref: buildAppointmentDetailHref(row.id),
      };
    })
    .filter((item): item is CrmAppointmentListItem => item !== null);

  if (search) {
    appointments = appointments.filter((item) => {
      const haystack = `${item.clientDisplayName} ${item.templateLabel} ${item.title ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  const totalCount = count ?? appointments.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    view,
    appointments,
    page,
    pageSize,
    totalCount,
    totalPages,
    partialDataWarning: false,
  };
}
