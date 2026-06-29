import "server-only";

import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import type { AppClientRow } from "@/lib/supabase/userProfile";

/** Canonical CRM V2 relationship identity — relationshipId equals clients.id (Phase 02). */
export type CrmRelationshipKind = "single_person";

export type CrmRelationshipIdentity = {
  relationshipId: string;
  clientId: string;
  relationshipKind: CrmRelationshipKind;
};

export type ResolveAuthorizedRelationshipResult =
  | { ok: false; reason: "not_found" }
  | { ok: true; identity: CrmRelationshipIdentity; client: AppClientRow };

/**
 * Resolves a relationship through adviser-client assignment.
 * Denies forged or unassigned IDs without revealing existence.
 */
export async function resolveAuthorizedRelationship(
  authUserId: string,
  userRole: "advisor" | "admin",
  relationshipId: string,
): Promise<ResolveAuthorizedRelationshipResult> {
  const access = await resolveAccessibleClient(authUserId, userRole, relationshipId);
  if (access.status !== "ok") {
    return { ok: false, reason: "not_found" };
  }

  return {
    ok: true,
    identity: {
      relationshipId: access.client.id,
      clientId: access.client.id,
      relationshipKind: "single_person",
    },
    client: access.client,
  };
}

export function toRelationshipIdentity(client: AppClientRow): CrmRelationshipIdentity {
  return {
    relationshipId: client.id,
    clientId: client.id,
    relationshipKind: "single_person",
  };
}
