import "server-only";

import type { MeetingSessionStatus } from "./meetingStudioTypes";
import { isMeetingSectionType, type MeetingSectionType } from "./meetingStudioTypes";

/** Allowed status transitions for Meeting Studio sessions. */
export const MEETING_STATUS_TRANSITIONS: Readonly<
  Record<MeetingSessionStatus, readonly MeetingSessionStatus[]>
> = {
  draft: ["prepared", "cancelled"],
  prepared: ["in_progress", "cancelled", "archived"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: ["archived"],
  archived: [],
};

export const IMMUTABLE_MEETING_STATUSES: readonly MeetingSessionStatus[] = [
  "completed",
  "archived",
];

const IMMUTABLE_PATCH_KEYS = new Set([
  "selected_sections",
  "section_order",
  "sections_shown",
  "skipped_sections",
  "fact_confirmations",
  "scenario_selections",
  "acknowledgements",
  "close_state",
  "summary_payload",
  "summary_status",
  "started_at",
  "ended_at",
  "completed_at",
  "appointment_id",
  "adviser_user_id",
  "client_id",
  "relationship_stage_at_start",
  "data_snapshot_version",
]);

export function assertStatusTransition(
  current: MeetingSessionStatus,
  next: MeetingSessionStatus,
): void {
  if (current === next) {
    return;
  }
  const allowed = MEETING_STATUS_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid session transition: ${current} → ${next}`);
  }
}

export function assertSessionPatchAllowed(
  currentStatus: MeetingSessionStatus,
  patch: Record<string, unknown>,
): void {
  if (!IMMUTABLE_MEETING_STATUSES.includes(currentStatus)) {
    return;
  }

  for (const key of Object.keys(patch)) {
    if (IMMUTABLE_PATCH_KEYS.has(key)) {
      throw new Error("Completed sessions cannot be modified");
    }
  }
}

export function normalizeSelectedSections(
  sections: string[],
): MeetingSectionType[] {
  const seen = new Set<MeetingSectionType>();
  const normalized: MeetingSectionType[] = [];

  for (const raw of sections) {
    if (!isMeetingSectionType(raw)) {
      throw new Error(`Unknown section type: ${raw}`);
    }
    if (raw === "welcome") {
      continue;
    }
    if (!seen.has(raw)) {
      seen.add(raw);
      normalized.push(raw);
    }
  }

  return normalized;
}

export function normalizeSectionOrder(
  order: string[],
  selected: MeetingSectionType[],
): MeetingSectionType[] {
  const selectedSet = new Set(selected);
  const seen = new Set<MeetingSectionType>();
  const normalized: MeetingSectionType[] = ["welcome"];

  for (const raw of order) {
    if (!isMeetingSectionType(raw)) {
      throw new Error(`Unknown section type in order: ${raw}`);
    }
    if (raw === "welcome") {
      continue;
    }
    if (!selectedSet.has(raw) || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    normalized.push(raw);
  }

  for (const section of selected) {
    if (!seen.has(section)) {
      normalized.push(section);
    }
  }

  return normalized;
}
