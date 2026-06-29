import {
  canAdviserTransition,
  canClientTransition,
  CRM_APPOINTMENT_CREATION_ALLOWED_STATUSES,
  CRM_APPOINTMENT_LIFECYCLE_STATUSES,
  CRM_APPOINTMENT_TERMINAL_STATUSES,
  CrmAppointmentTransitionError,
  deriveAdviserActions,
  isCreationAllowedStatus,
  isTerminalLifecycleStatus,
  mapLifecycleToLegacyStatus,
  validateAppointmentTransition,
} from "./lifecycle";

const NOW = "2026-06-29T10:00:00.000Z";

function assertThrows(fn: () => void, code: string): void {
  try {
    fn();
    throw new Error(`Expected ${code}`);
  } catch (err) {
    if (!(err instanceof CrmAppointmentTransitionError)) {
      throw err;
    }
    if (err.code !== code) {
      throw new Error(`Expected ${code}, got ${err.code}`);
    }
  }
}

export function runAppointmentLifecycleTests(): { passed: number; failed: string[] } {
  const cases: Array<{ name: string; pass: boolean }> = [];

  for (const status of CRM_APPOINTMENT_LIFECYCLE_STATUSES) {
    cases.push({
      name: `canonical state defined: ${status}`,
      pass: CRM_APPOINTMENT_LIFECYCLE_STATUSES.includes(status),
    });
  }

  cases.push({
    name: "requested → proposed allowed for adviser",
    pass: canAdviserTransition("requested", "proposed"),
  });
  cases.push({
    name: "requested → confirmed allowed for adviser",
    pass: canAdviserTransition("requested", "confirmed"),
  });
  cases.push({
    name: "proposed → awaiting_confirmation allowed",
    pass: canAdviserTransition("proposed", "awaiting_confirmation"),
  });
  cases.push({
    name: "proposed → confirmed allowed",
    pass: canAdviserTransition("proposed", "confirmed"),
  });
  cases.push({
    name: "confirmed → preparing allowed",
    pass: canAdviserTransition("confirmed", "preparing"),
  });
  cases.push({
    name: "preparing → ready allowed",
    pass: canAdviserTransition("preparing", "ready"),
  });
  cases.push({
    name: "ready → in_progress allowed",
    pass: canAdviserTransition("ready", "in_progress"),
  });
  cases.push({
    name: "in_progress → follow_up_required allowed",
    pass: canAdviserTransition("in_progress", "follow_up_required"),
  });
  cases.push({
    name: "follow_up_required → closed allowed",
    pass: canAdviserTransition("follow_up_required", "closed"),
  });
  cases.push({
    name: "confirmed → rescheduled allowed",
    pass: canAdviserTransition("confirmed", "rescheduled"),
  });
  cases.push({
    name: "confirmed → cancelled_by_adviser allowed",
    pass: canAdviserTransition("confirmed", "cancelled_by_adviser"),
  });
  cases.push({
    name: "ready → no_show allowed",
    pass: canAdviserTransition("ready", "no_show"),
  });
  cases.push({
    name: "closed → confirmed rejected",
    pass: !canAdviserTransition("closed", "confirmed"),
  });
  cases.push({
    name: "terminal closed is terminal",
    pass: isTerminalLifecycleStatus("closed"),
  });

  try {
    validateAppointmentTransition({
      from: "confirmed",
      to: "preparing",
      actorRole: "adviser",
      reasonCode: "begin_preparation",
      occurredAt: NOW,
    });
    cases.push({ name: "validate confirmed → preparing", pass: true });
  } catch {
    cases.push({ name: "validate confirmed → preparing", pass: false });
  }

  try {
    assertThrows(
      () =>
        validateAppointmentTransition({
          from: "closed",
          to: "confirmed",
          actorRole: "adviser",
          reasonCode: "adviser_confirmed",
          occurredAt: NOW,
        }),
      "terminal_state",
    );
    cases.push({ name: "terminal transition throws terminal_state", pass: true });
  } catch {
    cases.push({ name: "terminal transition throws terminal_state", pass: false });
  }

  try {
    assertThrows(
      () =>
        validateAppointmentTransition({
          from: "closed",
          to: "closed",
          actorRole: "adviser",
          reasonCode: "adviser_confirmed",
          occurredAt: NOW,
        }),
      "same_state_noop",
    );
    cases.push({ name: "same state throws same_state_noop", pass: true });
  } catch {
    cases.push({ name: "same state throws same_state_noop", pass: false });
  }

  cases.push({
    name: "creation allowed for proposed",
    pass: isCreationAllowedStatus("proposed"),
  });
  cases.push({
    name: "creation rejected for closed",
    pass: !isCreationAllowedStatus("closed"),
  });
  cases.push({
    name: "all creation allowed statuses are canonical",
    pass: [...CRM_APPOINTMENT_CREATION_ALLOWED_STATUSES].every((s) =>
      CRM_APPOINTMENT_LIFECYCLE_STATUSES.includes(s),
    ),
  });
  cases.push({
    name: "mapLifecycleToLegacyStatus confirmed → confirmed",
    pass: mapLifecycleToLegacyStatus("confirmed") === "confirmed",
  });
  cases.push({
    name: "mapLifecycleToLegacyStatus preparing → pending",
    pass: mapLifecycleToLegacyStatus("preparing") === "pending",
  });
  cases.push({
    name: "client can cancel from proposed",
    pass: canClientTransition("proposed", "cancelled_by_client"),
  });
  cases.push({
    name: "deriveAdviserActions includes confirm for proposed",
    pass: deriveAdviserActions("proposed").includes("confirm"),
  });
  cases.push({
    name: "all terminal statuses recognized",
    pass: [...CRM_APPOINTMENT_TERMINAL_STATUSES].every((s) =>
      isTerminalLifecycleStatus(s),
    ),
  });

  const failed = cases.filter((c) => !c.pass).map((c) => c.name);
  return { passed: cases.length - failed.length, failed };
}
