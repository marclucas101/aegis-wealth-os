import "server-only";

import { createAdminSupabaseClient } from "./admin";
import type { CommunicationPreferencesRow } from "../communications/types";

const DEFAULT_PREFERENCES: Omit<CommunicationPreferencesRow, "client_id" | "updated_at"> = {
  in_app_operational: true,
  email_operational: true,
  educational_insights: true,
  market_updates: true,
  event_announcements: true,
  adviser_messages: true,
  promotional_content: false,
};

export async function dbLoadCommunicationPreferences(
  clientId: string,
): Promise<CommunicationPreferencesRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("communication_preferences")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load preferences: ${error.message}`);
  }

  if (data) {
    return data as CommunicationPreferencesRow;
  }

  const { data: created, error: insertError } = await admin
    .from("communication_preferences")
    .insert({ client_id: clientId, ...DEFAULT_PREFERENCES } as never)
    .select("*")
    .single();

  if (insertError) {
    return {
      client_id: clientId,
      ...DEFAULT_PREFERENCES,
      updated_at: new Date().toISOString(),
    };
  }

  return created as CommunicationPreferencesRow;
}

export async function dbUpdateCommunicationPreferences(
  clientId: string,
  patch: Partial<Omit<CommunicationPreferencesRow, "client_id" | "updated_at">>,
): Promise<CommunicationPreferencesRow> {
  await dbLoadCommunicationPreferences(clientId);

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("communication_preferences")
    .update(patch as never)
    .eq("client_id", clientId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update preferences: ${error.message}`);
  }

  return data as CommunicationPreferencesRow;
}
