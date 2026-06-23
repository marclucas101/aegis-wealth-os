import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import { BINDER_ERROR_CODES, BinderServiceError } from "./binderErrors";

export const BINDER_PUBLISHED_TAG = "binder_published";
export const BINDER_CLIENT_VISIBLE_TAG = "client_visible";

export async function isBinderClientPublicationEnabled(): Promise<boolean> {
  try {
    return await isFeatureEnabled("binder_client_publication");
  } catch {
    return false;
  }
}

type BinderLinkRow = {
  id: string;
  client_id: string;
  status: string;
  generation_status: string;
  withdrawn_at: string | null;
  published_document_id: string | null;
  version: number;
};

export async function loadBinderByPublishedDocumentId(
  documentId: string,
  clientId: string,
): Promise<BinderLinkRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("id, client_id, status, generation_status, withdrawn_at, published_document_id, version")
    .eq("published_document_id", documentId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }

  return (data as BinderLinkRow | null) ?? null;
}

export function isBinderDocumentTags(tags: string[] | null | undefined): boolean {
  return Array.isArray(tags) && tags.includes(BINDER_PUBLISHED_TAG);
}

/**
 * Ensures a binder-linked vault document is still client-accessible.
 * Already-published binders remain readable when binder_client_publication is disabled.
 */
export async function assertBinderDocumentClientAccessible(input: {
  documentId: string;
  clientId: string;
  tags: string[] | null;
}): Promise<void> {
  if (!isBinderDocumentTags(input.tags)) {
    return;
  }

  const binder = await loadBinderByPublishedDocumentId(input.documentId, input.clientId);
  if (!binder) {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }

  if (binder.generation_status !== "ready") {
    throw new BinderServiceError(BINDER_ERROR_CODES.NOT_READY);
  }

  if (binder.status !== "published_to_client" || binder.withdrawn_at) {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }
}

export async function requireBinderClientPublicationFeature(): Promise<void> {
  const enabled = await isBinderClientPublicationEnabled();
  if (!enabled) {
    throw new BinderServiceError(BINDER_ERROR_CODES.PUBLICATION_DENIED);
  }
}
