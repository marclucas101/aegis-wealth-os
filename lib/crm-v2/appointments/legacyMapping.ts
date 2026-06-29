import type { CrmAppointmentLifecycleStatus } from "./lifecycle";

type LegacyAppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "failed";

export type { LegacyAppointmentStatus };

/**
 * Deterministic legacy → CRM lifecycle mapping for rows without crm_lifecycle_status.
 * Does not invent transition history.
 */
export function mapLegacyStatusToLifecycle(
  legacyStatus: LegacyAppointmentStatus,
): CrmAppointmentLifecycleStatus {
  switch (legacyStatus) {
    case "pending":
      return "proposed";
    case "confirmed":
      return "confirmed";
    case "cancelled":
      return "legacy_cancelled";
    case "completed":
      return "closed";
    case "failed":
      return "legacy_failed";
    default:
      return "legacy_unknown";
  }
}

export function resolveEffectiveLifecycleStatus(input: {
  crmLifecycleStatus: string | null;
  legacyStatus: LegacyAppointmentStatus | string;
}): CrmAppointmentLifecycleStatus {
  if (input.crmLifecycleStatus) {
    return input.crmLifecycleStatus as CrmAppointmentLifecycleStatus;
  }
  const legacy = input.legacyStatus as LegacyAppointmentStatus;
  return mapLegacyStatusToLifecycle(legacy);
}
