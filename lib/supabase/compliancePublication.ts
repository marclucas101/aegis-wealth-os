import "server-only";

import { createAdminSupabaseClient } from "./admin";

import type {
  OutputAudience,
  PublicationStatus,
  PublishedOutputType,
  RelationshipStage,
} from "@/lib/compliance/types";

export type PublishedOutputRow = {
  id: string;
  client_id: string;
  output_type: PublishedOutputType;
  output_audience: OutputAudience;
  publication_status: PublicationStatus;
  safe_payload: Record<string, unknown>;
  source_input_version: string | null;
  algorithm_version: string | null;
  created_by_user_id: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  published_by_user_id: string | null;
  published_at: string | null;
  expires_at: string | null;
  superseded_at: string | null;
  superseded_by_id: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  created_at: string;
  updated_at: string;
};

export async function dbLoadPublishedOutputById(
  outputId: string,
): Promise<PublishedOutputRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("published_outputs")
    .select("*")
    .eq("id", outputId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load published output: ${error.message}`);
  }

  return (data as PublishedOutputRow | null) ?? null;
}

export async function dbLoadPublishedOutputsForClient(
  clientId: string,
  outputType: PublishedOutputType,
  audience: OutputAudience,
  status: PublicationStatus = "published",
): Promise<PublishedOutputRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("published_outputs")
    .select("*")
    .eq("client_id", clientId)
    .eq("output_type", outputType)
    .eq("output_audience", audience)
    .eq("publication_status", status)
    .is("withdrawn_at", null)
    .is("superseded_at", null)
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load published outputs: ${error.message}`);
  }

  return (data ?? []) as PublishedOutputRow[];
}

export async function dbListPublishedOutputsForClient(
  clientId: string,
): Promise<PublishedOutputRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("published_outputs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list published outputs: ${error.message}`);
  }

  return (data ?? []) as PublishedOutputRow[];
}

export async function dbInsertPublishedOutput(
  row: Record<string, unknown>,
): Promise<PublishedOutputRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("published_outputs")
    .insert(row as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to insert published output: ${error.message}`);
  }

  return data as PublishedOutputRow;
}

export async function dbUpdatePublishedOutput(
  outputId: string,
  patch: Record<string, unknown>,
  expectedClientId?: string,
): Promise<PublishedOutputRow> {
  const admin = createAdminSupabaseClient();
  let query = admin.from("published_outputs").update(patch as never).eq("id", outputId);

  if (expectedClientId) {
    query = query.eq("client_id", expectedClientId);
  }

  const { data, error } = await query.select("*").single();

  if (error) {
    throw new Error(`Failed to update published output: ${error.message}`);
  }

  return data as PublishedOutputRow;
}

export async function dbSupersedePublishedOutput(
  outputId: string,
  supersededById: string,
  now: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("published_outputs")
    .update({
      publication_status: "superseded",
      superseded_at: now,
      superseded_by_id: supersededById,
    } as never)
    .eq("id", outputId)
    .eq("publication_status", "published");

  if (error) {
    throw new Error(`Failed to supersede published output: ${error.message}`);
  }
}

export async function dbLoadClientRelationshipStage(
  clientId: string,
): Promise<RelationshipStage | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .select("relationship_stage")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client relationship stage: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return (data as { relationship_stage: RelationshipStage }).relationship_stage;
}

export async function dbUpdateClientRelationshipStage(
  clientId: string,
  nextStage: RelationshipStage,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("clients")
    .update({ relationship_stage: nextStage } as never)
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to update relationship stage: ${error.message}`);
  }
}

export async function dbLoadClientAdvisorAssignment(
  clientId: string,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .select("advisor_user_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client assignment: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return (data as { advisor_user_id: string | null }).advisor_user_id;
}
