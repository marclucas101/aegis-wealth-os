import "server-only";

import { createAdminSupabaseClient } from "./admin";
import type { BinderExportRow, BinderExportStatus } from "../communications/types";

export async function dbCreateBinderExport(input: {
  clientId: string;
  adviserUserId: string;
  meetingDate?: string | null;
  sectionsIncluded: string[];
  sourcePublicationIds: string[];
  documentIds: string[];
  storagePath?: string | null;
}): Promise<BinderExportRow> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("binder_exports")
    .insert({
      client_id: input.clientId,
      adviser_user_id: input.adviserUserId,
      meeting_date: input.meetingDate ?? null,
      sections_included: input.sectionsIncluded,
      source_publication_ids: input.sourcePublicationIds,
      document_ids: input.documentIds,
      storage_path: input.storagePath ?? null,
      status: "generated",
      published_to_client: false,
      version: 1,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create binder export: ${error.message}`);
  }

  return data as BinderExportRow;
}

export async function dbLoadBinderExport(id: string): Promise<BinderExportRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load binder export: ${error.message}`);
  }

  return data as BinderExportRow | null;
}

export async function dbUpdateBinderExport(
  id: string,
  patch: Partial<{
    status: BinderExportStatus;
    published_to_client: boolean;
    published_at: string | null;
    storage_path: string | null;
  }>,
): Promise<BinderExportRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update binder export: ${error.message}`);
  }

  return data as BinderExportRow;
}

export async function dbListBinderExportsForAdviser(
  adviserUserId: string,
): Promise<BinderExportRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("*")
    .eq("adviser_user_id", adviserUserId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list binder exports: ${error.message}`);
  }

  return (data ?? []) as BinderExportRow[];
}
