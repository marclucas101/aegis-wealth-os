import "server-only";

import { isProspectStage } from "@/lib/compliance/relationshipStage";
import type { AppClientRow } from "@/lib/supabase/userProfile";

type DocumentVisibilityRow = {
  uploaded_by_user_id: string | null;
  tags: string[] | null;
  is_archived: boolean;
};

export function canClientViewDocument(input: {
  client: AppClientRow;
  clientUserId: string;
  document: DocumentVisibilityRow;
}): boolean {
  if (input.document.is_archived) {
    return false;
  }

  const isProspect = isProspectStage(input.client.relationship_stage);

  if (!isProspect) {
    return true;
  }

  const uploadedByClient =
    input.document.uploaded_by_user_id === input.clientUserId;
  const publishedToClient =
    Array.isArray(input.document.tags) &&
    input.document.tags.includes("client_visible");

  return uploadedByClient || publishedToClient;
}
