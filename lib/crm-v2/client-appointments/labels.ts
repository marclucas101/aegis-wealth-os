import type { CrmAppointmentLifecycleStatus } from "@/lib/crm-v2/appointments/lifecycle";

/** Client-safe lifecycle labels — no internal CRM terminology. */
export function clientLifecycleDisplayLabel(
  status: CrmAppointmentLifecycleStatus,
): string {
  switch (status) {
    case "requested":
      return "Request submitted — awaiting adviser review";
    case "proposed":
    case "awaiting_confirmation":
      return "Proposed time — please review";
    case "rescheduled":
      return "Reschedule proposed — please review";
    case "confirmed":
      return "Confirmed";
    case "preparing":
    case "ready":
      return "Preparing for your meeting";
    case "in_progress":
      return "Meeting in progress";
    case "follow_up_required":
      return "Follow-up in progress";
    case "closed":
      return "Completed";
    case "cancelled_by_client":
      return "Cancelled";
    case "cancelled_by_adviser":
      return "Cancelled by your adviser";
    case "no_show":
      return "Did not take place";
    default:
      return "In progress";
  }
}

export function clientAppointmentActionErrorMessage(
  reason?: string,
  fallback = "Something went wrong. Please try again or contact your adviser.",
): string {
  if (!reason || reason === "feature_disabled") {
    return "Appointments are currently unavailable.";
  }
  if (reason === "unauthenticated") {
    return "Please sign in to continue.";
  }
  if (reason === "forbidden") {
    return "You do not have access to this appointment.";
  }
  if (reason === "conflict") {
    return "This appointment was updated recently. Please refresh and try again.";
  }
  if (reason === "validation") {
    return "Please check your details and try again.";
  }
  return fallback;
}
