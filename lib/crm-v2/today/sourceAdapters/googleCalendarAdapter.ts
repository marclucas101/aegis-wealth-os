import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCalendarConnectionStatus } from "@/lib/supabase/calendarPersistence";

import { buildTodayCardRouteHref } from "../routes";
import type { TodayCardDto } from "../types";

type SyncMappingRow = {
  sync_status: string;
  safe_error_code: string | null;
  last_attempted_sync_at: string | null;
  updated_at: string;
};

/**
 * Safe Google Calendar status projection — no OAuth tokens, no raw provider errors.
 * Uses stored connection and mapping status only; no Google API calls on read.
 */
export async function loadGoogleCalendarTodayCards(input: {
  authUserId: string;
}): Promise<{ cards: TodayCardDto[]; failed: boolean }> {
  try {
    const cards: TodayCardDto[] = [];
    const connection = await getCalendarConnectionStatus(input.authUserId);

    if (!connection.connected || connection.revoked) {
      cards.push({
        id: `today:google_calendar:connection:${input.authUserId}`,
        sourceType: "google_calendar_connection",
        sourceId: input.authUserId,
        relationshipId: null,
        clientDisplayName: null,
        cardType: "google_calendar_sync",
        title: "Google Calendar not connected",
        summary: "Connect Google Calendar to sync confirmed appointments.",
        dueAt: null,
        section: "sync_operations",
        actionLabel: "Open calendar settings",
        routeHref: buildTodayCardRouteHref({
          sourceType: "google_calendar_connection",
          sourceId: input.authUserId,
          relationshipId: null,
        }),
        sourceStatus: connection.revoked ? "revoked" : "not_connected",
        severity: "attention",
        freshnessAt: new Date().toISOString(),
        actionRequired: true,
        blocked: false,
        sourceVersion: null,
      });
      return { cards, failed: false };
    }

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("crm_google_calendar_event_mappings")
      .select("sync_status, safe_error_code, last_attempted_sync_at, updated_at")
      .eq("adviser_user_id", input.authUserId)
      .is("deleted_at", null)
      .in("sync_status", ["failed", "action_required", "pending"])
      .order("updated_at", { ascending: false })
      .limit(5);

    if (error) {
      return { cards: [], failed: true };
    }

    const rows = (data ?? []) as SyncMappingRow[];
    for (const row of rows) {
      const safeSummary =
        row.sync_status === "failed"
          ? "A mapped appointment needs sync attention."
          : row.sync_status === "action_required"
            ? "Google Calendar reauthorization may be required."
            : "A calendar sync is pending longer than expected.";

      cards.push({
        id: `today:google_calendar:sync:${row.updated_at}`,
        sourceType: "google_calendar_sync",
        sourceId: row.updated_at,
        relationshipId: null,
        clientDisplayName: null,
        cardType: "google_calendar_sync",
        title:
          row.sync_status === "action_required"
            ? "Google Calendar reauthorization required"
            : "Google Calendar sync needs attention",
        summary: safeSummary,
        dueAt: row.last_attempted_sync_at,
        section: "sync_operations",
        actionLabel: "Open calendar settings",
        routeHref: buildTodayCardRouteHref({
          sourceType: "google_calendar_sync",
          sourceId: row.updated_at,
          relationshipId: null,
        }),
        sourceStatus: row.sync_status,
        severity: row.sync_status === "failed" ? "urgent" : "attention",
        freshnessAt: row.updated_at,
        actionRequired: true,
        blocked: false,
        sourceVersion: null,
      });
    }

    return { cards, failed: false };
  } catch {
    return { cards: [], failed: true };
  }
}
