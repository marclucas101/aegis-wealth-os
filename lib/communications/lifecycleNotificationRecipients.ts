import "server-only";

import { isActiveClientStage } from "@/lib/compliance/relationshipStage";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppClientRow } from "@/lib/supabase/userProfile";

import { contentMatchesAudience } from "./audienceTargeting";
import type { GovernedContentRow } from "./types";
import type { LifecycleSourceEntityType } from "./lifecycleNotificationTypes";

export type RecipientResolutionResult =
  | { eligible: true; clientId: string }
  | { eligible: false; reason: string };

async function loadActiveClient(clientId: string): Promise<AppClientRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .select(
      "id, user_id, advisor_user_id, display_name, relationship_stage, status",
    )
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as AppClientRow;
  if (row.status !== "active") {
    return null;
  }

  return row;
}

export async function resolveClientRecipient(input: {
  clientId: string;
  requireActiveClient?: boolean;
}): Promise<RecipientResolutionResult> {
  const client = await loadActiveClient(input.clientId);
  if (!client) {
    return { eligible: false, reason: "client_not_found_or_inactive" };
  }

  if (input.requireActiveClient !== false && !isActiveClientStage(client.relationship_stage)) {
    return { eligible: false, reason: "client_not_active_stage" };
  }

  if (!client.user_id) {
    return { eligible: false, reason: "client_user_missing" };
  }

  const admin = createAdminSupabaseClient();
  const { data: user } = await admin
    .from("users")
    .select("id, status")
    .eq("id", client.user_id)
    .maybeSingle();

  if (!user || (user as { status?: string }).status === "inactive") {
    return { eligible: false, reason: "client_user_inactive" };
  }

  return { eligible: true, clientId: client.id };
}

export async function resolveGovernedContentRecipients(
  row: GovernedContentRow,
): Promise<string[]> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("clients")
    .select("id, relationship_stage, advisor_user_id")
    .eq("status", "active");

  if (row.target_client_ids.length > 0) {
    query = query.in("id", row.target_client_ids);
  } else if (row.audience_scope === "assigned_active_clients" && row.adviser_user_id) {
    query = query
      .eq("advisor_user_id", row.adviser_user_id)
      .eq("relationship_stage", "active_client");
  } else if (row.audience_scope === "all_active_clients") {
    query = query.eq("relationship_stage", "active_client");
  } else if (row.audience_scope === "assigned_prospects" && row.adviser_user_id) {
    query = query
      .eq("advisor_user_id", row.adviser_user_id)
      .eq("relationship_stage", "prospect");
  } else if (row.audience_scope === "all_prospects") {
    query = query.eq("relationship_stage", "prospect");
  } else {
    return [];
  }

  const { data } = await query;
  const clients = (data ?? []) as {
    id: string;
    relationship_stage: AppClientRow["relationship_stage"];
    advisor_user_id: string | null;
  }[];

  return clients
    .filter((client) =>
      contentMatchesAudience(row, {
        clientId: client.id,
        relationshipStage: client.relationship_stage,
        adviserUserId: client.advisor_user_id,
      }),
    )
    .map((client) => client.id);
}

export async function validatePublicationRecipient(input: {
  clientId: string;
  outputAudience: string;
  publicationStatus: string;
}): Promise<RecipientResolutionResult> {
  if (input.outputAudience !== "client_published") {
    return { eligible: false, reason: "adviser_only_output" };
  }

  if (!["published", "superseded", "withdrawn", "expired"].includes(input.publicationStatus)) {
    return { eligible: false, reason: "publication_not_client_visible" };
  }

  return resolveClientRecipient({ clientId: input.clientId });
}

export async function validateDocumentRecipient(input: {
  clientId: string;
  documentId: string;
  isClientVisible: boolean;
}): Promise<RecipientResolutionResult> {
  if (!input.isClientVisible) {
    return { eligible: false, reason: "document_not_client_visible" };
  }

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("documents")
    .select("id, is_archived, client_id")
    .eq("id", input.documentId)
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (!data) {
    return { eligible: false, reason: "document_not_found" };
  }

  const row = data as { is_archived: boolean };
  if (row.is_archived && input.isClientVisible) {
    // Archived documents may still notify for withdrawal/replaced events at transition time.
  }

  return resolveClientRecipient({ clientId: input.clientId });
}

export function referenceTypeForSource(
  sourceEntityType: LifecycleSourceEntityType,
): string {
  return sourceEntityType;
}
