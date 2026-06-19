import "server-only";

import type { CloseState } from "./meetingStudioTypes";

const CLOSE_STATE_ALLOWLIST = new Set([
  "meetingVisibleObservations",
  "agreedPriorities",
  "deferredTopics",
  "clientQuestions",
  "administrativeNextSteps",
  "followUpDocuments",
  "nextAppointmentId",
  "clientTaskIds",
  "adviserTaskIds",
  "clientSafeSummaryText",
  "internalAdviserNotes",
]);

/** Strip internal notes from meeting-visible payloads. */
export function toMeetingVisibleCloseState(closeState: CloseState): Omit<
  CloseState,
  "internalAdviserNotes"
> {
  const {
    internalAdviserNotes: _internal,
    ...visible
  } = closeState;
  void _internal;
  return visible;
}

export function sanitizeCloseStatePatch(input: unknown): CloseState {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid close state");
  }

  const source = input as Record<string, unknown>;
  const result: CloseState = {};

  for (const key of Object.keys(source)) {
    if (!CLOSE_STATE_ALLOWLIST.has(key)) {
      throw new Error(`Non-allowlisted close state key: ${key}`);
    }
  }

  if (Array.isArray(source.meetingVisibleObservations)) {
    result.meetingVisibleObservations = source.meetingVisibleObservations.map(
      String,
    );
  }
  if (Array.isArray(source.agreedPriorities)) {
    result.agreedPriorities = source.agreedPriorities.map(String);
  }
  if (Array.isArray(source.deferredTopics)) {
    result.deferredTopics = source.deferredTopics.map(String);
  }
  if (Array.isArray(source.clientQuestions)) {
    result.clientQuestions = source.clientQuestions.map(String);
  }
  if (Array.isArray(source.administrativeNextSteps)) {
    result.administrativeNextSteps = source.administrativeNextSteps.map(String);
  }
  if (Array.isArray(source.followUpDocuments)) {
    result.followUpDocuments = source.followUpDocuments.map(String);
  }
  if (typeof source.clientSafeSummaryText === "string") {
    result.clientSafeSummaryText = source.clientSafeSummaryText.slice(0, 8000);
  }
  if (typeof source.internalAdviserNotes === "string") {
    result.internalAdviserNotes = source.internalAdviserNotes.slice(0, 8000);
  }
  if (
    source.nextAppointmentId === null ||
    typeof source.nextAppointmentId === "string"
  ) {
    result.nextAppointmentId = source.nextAppointmentId as string | null;
  }

  return result;
}
