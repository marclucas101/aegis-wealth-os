import "server-only";

import { isActiveClientStage, isProspectStage } from "@/lib/compliance/relationshipStage";
import type { RelationshipStage } from "@/lib/compliance/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import { isClientVisibleStatus } from "./contentLifecycle";
import type { AudienceScope, GovernedContentRow } from "./types";

export type AudienceContext = {
  clientId: string;
  relationshipStage: RelationshipStage;
  adviserUserId: string | null;
};

export function isPublishedAndCurrent(row: GovernedContentRow): boolean {
  return isClientVisibleStatus(row);
}

export function contentMatchesAudience(
  row: GovernedContentRow,
  ctx: AudienceContext,
): boolean {
  if (!isPublishedAndCurrent(row)) {
    return false;
  }

  if (row.content_type === "internal_adviser") {
    return false;
  }

  const stage = ctx.relationshipStage;

  if (row.target_relationship_stages.length > 0) {
    if (!row.target_relationship_stages.includes(stage)) {
      return false;
    }
  }

  switch (row.audience_scope) {
    case "all_active_clients":
      return isActiveClientStage(stage);

    case "assigned_active_clients":
      return (
        isActiveClientStage(stage) &&
        row.adviser_user_id !== null &&
        row.adviser_user_id === ctx.adviserUserId
      );

    case "all_prospects":
      return isProspectStage(stage);

    case "assigned_prospects":
      return (
        isProspectStage(stage) &&
        row.adviser_user_id !== null &&
        row.adviser_user_id === ctx.adviserUserId
      );

    case "selected_clients":
      return (
        row.target_client_ids.includes(ctx.clientId) &&
        (row.adviser_user_id === null || row.adviser_user_id === ctx.adviserUserId)
      );

    case "public_education":
      return true;

    case "internal_advisers":
      return false;

    default:
      return false;
  }
}

export async function validateTargetClientIds(
  adviserUserId: string,
  userRole: "advisor" | "admin",
  clientIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (clientIds.length === 0) {
    return { ok: false, error: "At least one client must be selected" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .select("id, advisor_user_id")
    .in("id", clientIds);

  if (error) {
    throw new Error(`Failed to validate client targets: ${error.message}`);
  }

  const found = (data ?? []) as { id: string; advisor_user_id: string | null }[];
  if (found.length !== clientIds.length) {
    return { ok: false, error: "One or more client IDs are invalid" };
  }

  if (userRole === "advisor") {
    for (const client of found) {
      if (client.advisor_user_id !== adviserUserId) {
        return { ok: false, error: "Cannot target clients not assigned to you" };
      }
    }
  }

  return { ok: true };
}

export function adviserPermittedAudienceScopes(
  userRole: "advisor" | "admin",
): AudienceScope[] {
  if (userRole === "admin") {
    return [
      "all_active_clients",
      "assigned_active_clients",
      "all_prospects",
      "assigned_prospects",
      "selected_clients",
      "public_education",
    ];
  }

  return ["assigned_active_clients", "assigned_prospects", "selected_clients"];
}
