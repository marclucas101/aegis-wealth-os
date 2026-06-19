import "server-only";

import type { ContentApprovalStatus, GovernedContentRow } from "./types";

/** Legal approval-status transitions (Phase 9E). */
const LEGAL_TRANSITIONS: Record<ContentApprovalStatus, readonly ContentApprovalStatus[]> = {
  draft: ["submitted_for_review", "archived"],
  submitted_for_review: ["approved", "changes_requested", "rejected"],
  changes_requested: ["submitted_for_review", "archived"],
  approved: ["scheduled", "published", "archived"],
  scheduled: ["published", "withdrawn", "archived"],
  published: ["expired", "withdrawn", "archived"],
  expired: ["archived"],
  rejected: ["archived"],
  withdrawn: ["archived"],
  archived: [],
};

export function assertLegalTransition(
  from: ContentApprovalStatus,
  to: ContentApprovalStatus,
): void {
  const allowed = LEGAL_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid content transition: ${from} → ${to}`);
  }
}

export function canTransition(
  from: ContentApprovalStatus,
  to: ContentApprovalStatus,
): boolean {
  return (LEGAL_TRANSITIONS[from] ?? []).includes(to);
}

export function isClientVisibleStatus(row: GovernedContentRow): boolean {
  if (row.approval_status !== "published") {
    return false;
  }
  if (row.withdrawn_at) {
    return false;
  }
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return false;
  }
  if (row.scheduled_at && new Date(row.scheduled_at) > new Date()) {
    return false;
  }
  return true;
}

export function assertPublishable(row: GovernedContentRow): void {
  if (row.withdrawn_at) {
    throw new Error("Withdrawn content cannot be published");
  }
  if (!["approved", "scheduled"].includes(row.approval_status)) {
    throw new Error("Only approved content can be published");
  }
  if (row.approval_status === "approved" && !row.approved_by_user_id) {
    throw new Error("Content lacks approval record");
  }
}

export function assertNotPublishedInPlaceEdit(row: GovernedContentRow): void {
  if (row.approval_status === "published" && !row.supersedes_content_id) {
    throw new Error("Published content cannot be silently edited");
  }
}
