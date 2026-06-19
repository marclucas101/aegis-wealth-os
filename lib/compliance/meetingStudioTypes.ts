/** Presentation section types for Meeting Studio controlled reveal. */
export type MeetingSectionType =
  | "welcome"
  | "priorities"
  | "facts_and_assumptions"
  | "financial_foundation"
  | "broad_strengths"
  | "areas_for_review"
  | "protection_resilience"
  | "scenario_education"
  | "goal_alignment"
  | "adviser_observations"
  | "agreed_priorities"
  | "next_steps";

export const MEETING_SECTION_TYPES: readonly MeetingSectionType[] = [
  "welcome",
  "priorities",
  "facts_and_assumptions",
  "financial_foundation",
  "broad_strengths",
  "areas_for_review",
  "protection_resilience",
  "scenario_education",
  "goal_alignment",
  "adviser_observations",
  "agreed_priorities",
  "next_steps",
] as const;

export const DEFAULT_PRESENTATION_ORDER: readonly MeetingSectionType[] =
  MEETING_SECTION_TYPES;

export const SELECTABLE_SECTIONS: readonly MeetingSectionType[] =
  MEETING_SECTION_TYPES.filter((s) => s !== "welcome");

export type MeetingSessionStatus =
  | "draft"
  | "prepared"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "archived";

export const MEETING_SESSION_STATUSES: readonly MeetingSessionStatus[] = [
  "draft",
  "prepared",
  "in_progress",
  "completed",
  "cancelled",
  "archived",
] as const;

export type MeetingType =
  | "initial"
  | "review"
  | "follow_up"
  | "planning"
  | "other";

export const MEETING_TYPES: readonly MeetingType[] = [
  "initial",
  "review",
  "follow_up",
  "planning",
  "other",
] as const;

export type MeetingSummaryStatus =
  | "draft"
  | "adviser_reviewed"
  | "ready_for_publication"
  | "published"
  | "archived";

export const MEETING_SUMMARY_STATUSES: readonly MeetingSummaryStatus[] = [
  "draft",
  "adviser_reviewed",
  "ready_for_publication",
  "published",
  "archived",
] as const;

export type FactConfirmationStatus = "confirmed" | "corrected" | "pending";

export type FactConfirmationRecord = {
  fieldKey: string;
  label: string;
  currentValue: string | null;
  status: FactConfirmationStatus;
  correctedValue?: string | null;
  requiresRecalculation: boolean;
  confirmedByUserId: string;
  confirmedAt: string;
};

export type ScenarioSelection = {
  scenarioKey: string;
  label: string;
  adviserExplanation: string | null;
  selectedAt: string;
  selectedByUserId: string;
};

export type AcknowledgementRecord = {
  itemKey: string;
  label: string;
  method: "verbal_recorded" | "on_screen";
  recordedByUserId: string;
  recordedAt: string;
  acknowledgementVersion: string;
};

export type CloseState = {
  internalAdviserNotes?: string;
  meetingVisibleObservations?: string[];
  clientSafeSummaryText?: string;
  clientQuestions?: string[];
  deferredTopics?: string[];
  agreedPriorities?: string[];
  followUpDocuments?: string[];
  administrativeNextSteps?: string[];
  nextAppointmentId?: string | null;
  clientTaskIds?: string[];
  adviserTaskIds?: string[];
};

export type PreparationState = {
  readinessChecklist?: Record<string, boolean>;
  selectedScenarios?: string[];
  notes?: string;
};

export type MeetingSessionEventType =
  | "session_created"
  | "preparation_saved"
  | "meeting_started"
  | "section_shown"
  | "section_skipped"
  | "fact_confirmed"
  | "fact_corrected"
  | "scenario_shown"
  | "acknowledgement_recorded"
  | "meeting_completed"
  | "summary_prepared"
  | "client_safe_publication_prepared";

export const STRESS_SCENARIO_KEYS = [
  "temporary_income_loss",
  "medical_event",
  "death_income_provider",
  "major_expense",
  "market_decline",
  "delayed_retirement",
  "increased_education_cost",
] as const;

export type StressScenarioKey = (typeof STRESS_SCENARIO_KEYS)[number];

export const STRESS_SCENARIO_LABELS: Record<StressScenarioKey, string> = {
  temporary_income_loss: "Temporary loss of income",
  medical_event: "Medical event",
  death_income_provider: "Death of an income provider",
  major_expense: "Major unexpected expense",
  market_decline: "Market decline",
  delayed_retirement: "Delayed retirement",
  increased_education_cost: "Increased education cost",
};

export const ACKNOWLEDGEMENT_ITEMS = [
  {
    key: "information_reviewed",
    label: "Information reviewed during the meeting",
  },
  {
    key: "assumptions_confirmed",
    label: "Assumptions confirmed or corrected",
  },
  {
    key: "scenarios_understood",
    label: "Scenarios understood as illustrations",
  },
  {
    key: "priorities_discussed",
    label: "Priorities discussed",
  },
  {
    key: "documents_to_provide",
    label: "Documents to provide",
  },
  {
    key: "follow_up_agreed",
    label: "Follow-up meeting agreed",
  },
] as const;

export function isMeetingSectionType(value: string): value is MeetingSectionType {
  return (MEETING_SECTION_TYPES as readonly string[]).includes(value);
}

export function isMeetingSessionStatus(
  value: string,
): value is MeetingSessionStatus {
  return (MEETING_SESSION_STATUSES as readonly string[]).includes(value);
}

export function isMeetingType(value: string): value is MeetingType {
  return (MEETING_TYPES as readonly string[]).includes(value);
}
