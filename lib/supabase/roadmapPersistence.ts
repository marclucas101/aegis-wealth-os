import "server-only";

import type { RoadmapItemStatus } from "@/lib/aegis/localProfile";

import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";

const ALLOWED_STATUSES: readonly RoadmapItemStatus[] = [
  "not_started",
  "in_progress",
  "completed",
] as const;

export function isValidRoadmapStatus(
  value: unknown,
): value is RoadmapItemStatus {
  return (
    typeof value === "string" &&
    (ALLOWED_STATUSES as readonly string[]).includes(value)
  );
}

export type PersistRoadmapStatusResult = {
  item_key: string;
  status: RoadmapItemStatus;
  updated_at: string;
};

type RoadmapItemTimestampRow = {
  id: string;
  started_at: string | null;
  completed_at: string | null;
};

type RoadmapItemUpdateRow = {
  item_key: string;
  status: RoadmapItemStatus;
  updated_at: string;
};

function buildStatusUpdate(
  status: RoadmapItemStatus,
  existing: RoadmapItemTimestampRow,
): Record<string, string | null> {
  const now = new Date().toISOString();

  if (status === "in_progress") {
    return {
      status,
      started_at: existing.started_at ?? now,
      completed_at: null,
    };
  }

  if (status === "completed") {
    return {
      status,
      completed_at: now,
    };
  }

  return {
    status,
    started_at: null,
    completed_at: null,
  };
}

/**
 * Updates a single active roadmap item status for the authenticated client.
 * client_id is derived server-side — never accepted from the browser.
 */
export async function persistRoadmapItemStatus(
  client: AppClientRow,
  itemKey: string,
  status: RoadmapItemStatus,
): Promise<PersistRoadmapStatusResult> {
  const admin = createAdminSupabaseClient();

  const { data: existing, error: fetchError } = await admin
    .from("roadmap_items")
    .select("id, started_at, completed_at")
    .eq("client_id", client.id)
    .eq("item_key", itemKey)
    .eq("is_active", true)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load roadmap item: ${fetchError.message}`);
  }

  if (!existing) {
    throw new Error("Roadmap item not found");
  }

  const updatePayload = buildStatusUpdate(
    status,
    existing as RoadmapItemTimestampRow,
  );

  const { data: updated, error: updateError } = await admin
    .from("roadmap_items")
    .update(updatePayload as never)
    .eq("id", (existing as RoadmapItemTimestampRow).id)
    .select("item_key, status, updated_at")
    .single();

  if (updateError) {
    throw new Error(`Failed to update roadmap status: ${updateError.message}`);
  }

  const row = updated as RoadmapItemUpdateRow;

  return {
    item_key: row.item_key,
    status: row.status,
    updated_at: row.updated_at,
  };
}
