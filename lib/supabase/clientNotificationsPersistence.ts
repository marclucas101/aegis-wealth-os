import "server-only";

import { createAdminSupabaseClient } from "./admin";
import type {
  ClientNotificationRow,
  ClientNotificationType,
} from "../communications/types";

export async function dbCreateClientNotification(input: {
  clientId: string;
  notificationType: ClientNotificationType;
  title: string;
  summary: string;
  referenceType?: string | null;
  referenceId?: string | null;
}): Promise<ClientNotificationRow> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("client_notifications")
    .insert({
      client_id: input.clientId,
      notification_type: input.notificationType,
      title: input.title.slice(0, 120),
      summary: input.summary.slice(0, 300),
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return data as ClientNotificationRow;
}

export async function dbListClientNotifications(
  clientId: string,
  limit = 50,
): Promise<ClientNotificationRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("client_notifications")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list notifications: ${error.message}`);
  }

  return (data ?? []) as ClientNotificationRow[];
}

export async function dbMarkNotificationRead(
  notificationId: string,
  clientId: string,
): Promise<ClientNotificationRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("client_notifications")
    .update({ read_at: new Date().toISOString() } as never)
    .eq("id", notificationId)
    .eq("client_id", clientId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark notification read: ${error.message}`);
  }

  return data as ClientNotificationRow | null;
}

export async function dbLoadClientNotification(
  notificationId: string,
  clientId: string,
): Promise<ClientNotificationRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("client_notifications")
    .select("*")
    .eq("id", notificationId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load notification: ${error.message}`);
  }

  return data as ClientNotificationRow | null;
}
