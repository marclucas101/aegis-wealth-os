import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import type { ClientNotificationRow } from "./types";
import type { LifecycleEventName, LifecycleSourceEntityType } from "./lifecycleNotificationTypes";

export type PersistLifecycleNotificationInput = {
  clientId: string;
  notificationType: string;
  title: string;
  summary: string;
  referenceType: string;
  referenceId: string;
  lifecycleEvent: LifecycleEventName;
  sourceEntityType: LifecycleSourceEntityType;
  sourceLifecycleVersion: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
};

export type PersistLifecycleNotificationResult =
  | { outcome: "created"; notification: ClientNotificationRow }
  | { outcome: "skipped_duplicate"; notification: ClientNotificationRow }
  | { outcome: "failed"; reason: string };

export async function persistLifecycleNotification(
  input: PersistLifecycleNotificationInput,
): Promise<PersistLifecycleNotificationResult> {
  const admin = createAdminSupabaseClient();

  const { data: existingByKey } = await admin
    .from("client_notifications")
    .select("*")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (existingByKey) {
    return {
      outcome: "skipped_duplicate",
      notification: existingByKey as ClientNotificationRow,
    };
  }

  const { data: existingByRef } = await admin
    .from("client_notifications")
    .select("*")
    .eq("client_id", input.clientId)
    .eq("notification_type", input.notificationType)
    .eq("reference_type", input.referenceType)
    .eq("reference_id", input.referenceId)
    .maybeSingle();

  if (existingByRef) {
    return {
      outcome: "skipped_duplicate",
      notification: existingByRef as ClientNotificationRow,
    };
  }

  const { data, error } = await admin
    .from("client_notifications")
    .insert({
      client_id: input.clientId,
      notification_type: input.notificationType,
      title: input.title.slice(0, 120),
      summary: input.summary.slice(0, 300),
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      lifecycle_event: input.lifecycleEvent,
      source_entity_type: input.sourceEntityType,
      source_lifecycle_version: input.sourceLifecycleVersion,
      idempotency_key: input.idempotencyKey,
      metadata: input.metadata,
    } as never)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await admin
        .from("client_notifications")
        .select("*")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();

      if (raced) {
        return {
          outcome: "skipped_duplicate",
          notification: raced as ClientNotificationRow,
        };
      }
    }

    return { outcome: "failed", reason: "notification_persistence_failed" };
  }

  return {
    outcome: "created",
    notification: data as ClientNotificationRow,
  };
}

