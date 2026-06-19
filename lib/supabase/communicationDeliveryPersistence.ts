import "server-only";

import { createAdminSupabaseClient } from "./admin";
import type { CommunicationDeliveryRow, DeliveryStatus } from "../communications/types";

export async function dbCreateDeliveryRecord(input: {
  communicationId?: string | null;
  notificationId?: string | null;
  clientId: string;
  channel?: "email" | "in_app";
}): Promise<CommunicationDeliveryRow> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("communication_deliveries")
    .insert({
      communication_id: input.communicationId ?? null,
      notification_id: input.notificationId ?? null,
      client_id: input.clientId,
      channel: input.channel ?? "email",
      delivery_status: "pending",
      attempt_count: 0,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create delivery record: ${error.message}`);
  }

  return data as CommunicationDeliveryRow;
}

export async function dbUpdateDeliveryStatus(
  id: string,
  patch: Partial<{
    delivery_status: DeliveryStatus;
    provider_reference: string | null;
    attempt_count: number;
    last_attempt_at: string;
    sent_at: string | null;
    failed_at: string | null;
    error_code: string | null;
  }>,
): Promise<CommunicationDeliveryRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("communication_deliveries")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update delivery: ${error.message}`);
  }

  return data as CommunicationDeliveryRow;
}

export async function dbListPendingDeliveries(): Promise<CommunicationDeliveryRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("communication_deliveries")
    .select("*")
    .in("delivery_status", ["pending", "retrying"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list pending deliveries: ${error.message}`);
  }

  return (data ?? []) as CommunicationDeliveryRow[];
}

export async function dbListDeliveriesForCommunication(
  communicationId: string,
): Promise<CommunicationDeliveryRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("communication_deliveries")
    .select("*")
    .eq("communication_id", communicationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list deliveries: ${error.message}`);
  }

  return (data ?? []) as CommunicationDeliveryRow[];
}

export async function dbCancelPendingDeliveriesForContent(
  communicationId: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("communication_deliveries")
    .update({
      delivery_status: "cancelled_withdrawn",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("communication_id", communicationId)
    .in("delivery_status", ["pending", "retrying"]);

  if (error) {
    throw new Error(`Failed to cancel deliveries: ${error.message}`);
  }
}

export async function dbListAllDeliveries(limit = 100): Promise<CommunicationDeliveryRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("communication_deliveries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list deliveries: ${error.message}`);
  }

  return (data ?? []) as CommunicationDeliveryRow[];
}
