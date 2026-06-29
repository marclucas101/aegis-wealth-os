import "server-only";

import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppClientRow } from "@/lib/supabase/userProfile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdviserAppointmentAuthRow = {
  id: string;
  adviser_user_id: string;
  client_id: string;
  client_user_id: string;
};

export type ResolveAuthorizedAppointmentResult =
  | { ok: false; reason: "not_found" }
  | { ok: true; appointment: AdviserAppointmentAuthRow; client: AppClientRow };

export function isValidAppointmentId(appointmentId: string): boolean {
  return UUID_RE.test(appointmentId);
}

/**
 * Resolves appointment through adviser assignment on the linked client.
 * Denies cross-adviser and forged IDs without existence disclosure.
 */
export async function resolveAuthorizedAppointment(
  authUserId: string,
  userRole: "advisor" | "admin",
  appointmentId: string,
): Promise<ResolveAuthorizedAppointmentResult> {
  if (!isValidAppointmentId(appointmentId)) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_appointments")
    .select("id, adviser_user_id, client_id, client_user_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to resolve appointment");
  }

  const row = data as AdviserAppointmentAuthRow | null;
  if (!row) {
    return { ok: false, reason: "not_found" };
  }

  const clientAccess = await resolveAccessibleClient(
    authUserId,
    userRole,
    row.client_id,
  );

  if (clientAccess.status !== "ok") {
    return { ok: false, reason: "not_found" };
  }

  if (userRole === "advisor" && row.adviser_user_id !== authUserId) {
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, appointment: row, client: clientAccess.client };
}
