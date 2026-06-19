import type { MeetingSectionType } from "./meetingStudioTypes";

/** Allowlisted keys for meeting_presentation safe payloads. */
export const MEETING_PRESENTATION_ALLOWLIST = [
  "sessionId",
  "clientName",
  "adviserName",
  "meetingDate",
  "dataAsAt",
  "meetingPurpose",
  "adviserLedLabel",
  "staleAnalysisWarning",
  "sections",
  "algorithmVersion",
] as const;

const PROHIBITED_PRESENTATION_KEYS = new Set([
  "rawShieldScore",
  "adjustedShieldScore",
  "shield",
  "pillarScores",
  "pillars",
  "protectionCore",
  "recommendedCoverage",
  "coverageGap",
  "productName",
  "productCategory",
  "internalNotes",
  "adviserNotes",
  "modelCoefficients",
  "weightings",
  "formData",
  "discoverScore",
  "rawInternalScore",
  "commission",
  "taskSuggestions",
  "complianceFlags",
  "__proto__",
  "constructor",
  "prototype",
]);

export type PresentationSectionPayload =
  | WelcomeSection
  | PrioritiesSection
  | FactsAndAssumptionsSection
  | FinancialFoundationSection
  | BroadStrengthsSection
  | AreasForReviewSection
  | ProtectionResilienceSection
  | ScenarioEducationSection
  | GoalAlignmentSection
  | AdviserObservationsSection
  | AgreedPrioritiesSection
  | NextStepsSection;

export type MeetingPresentationDto = {
  sessionId: string;
  clientName: string;
  adviserName: string;
  meetingDate: string | null;
  dataAsAt: string;
  meetingPurpose: string | null;
  adviserLedLabel: string;
  staleAnalysisWarning: string | null;
  sections: PresentationSectionPayload[];
  algorithmVersion: string;
};

type BaseSection = {
  sectionType: MeetingSectionType;
  heading: string;
  educationalLabel: string;
};

export type WelcomeSection = BaseSection & {
  sectionType: "welcome";
  purpose: string | null;
};

export type PrioritiesSection = BaseSection & {
  sectionType: "priorities";
  goals: string[];
  timeHorizons: string[];
};

export type FactItem = {
  label: string;
  value: string | null;
  status: "confirmed" | "corrected" | "pending" | "unchanged";
};

export type FactsAndAssumptionsSection = BaseSection & {
  sectionType: "facts_and_assumptions";
  facts: FactItem[];
};

export type FinancialFoundationSection = BaseSection & {
  sectionType: "financial_foundation";
  cashFlowPosition: string;
  emergencyFundRunway: string | null;
  debtOverview: string | null;
  monthlyCommitments: string | null;
  goalContributionCapacity: string | null;
  educationalRatios: Array<{ label: string; value: string; context: string }>;
};

export type BroadStrengthsSection = BaseSection & {
  sectionType: "broad_strengths";
  strengths: string[];
};

export type AreasForReviewSection = BaseSection & {
  sectionType: "areas_for_review";
  areas: string[];
};

export type ProtectionCategory = {
  category: string;
  relativeStrength: "strong" | "moderate" | "area_for_discussion";
  explanation: string;
  exactAmountIllustration?: string | null;
};

export type ProtectionResilienceSection = BaseSection & {
  sectionType: "protection_resilience";
  categories: ProtectionCategory[];
  assumptions: string[];
};

export type ScenarioIllustration = {
  label: string;
  assumption: string;
  illustration: string;
  adviserExplanation: string | null;
};

export type ScenarioEducationSection = BaseSection & {
  sectionType: "scenario_education";
  scenarios: ScenarioIllustration[];
};

export type GoalAlignmentSection = BaseSection & {
  sectionType: "goal_alignment";
  alignedGoals: string[];
  discussionPoints: string[];
};

export type AdviserObservationsSection = BaseSection & {
  sectionType: "adviser_observations";
  observations: string[];
};

export type AgreedPrioritiesSection = BaseSection & {
  sectionType: "agreed_priorities";
  priorities: string[];
  deferredTopics: string[];
};

export type NextStepsSection = BaseSection & {
  sectionType: "next_steps";
  clientTasks: string[];
  adviserTasks: string[];
  nextAppointment: string | null;
  administrativeSteps: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertNoProhibitedKeys(value: unknown, path = "payload", depth = 0): void {
  if (depth > 5) {
    throw new Error(`Nested presentation payload too deep at ${path}`);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertNoProhibitedKeys(value[i], `${path}[${i}]`, depth + 1);
    }
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const key of Object.keys(value)) {
    if (PROHIBITED_PRESENTATION_KEYS.has(key)) {
      throw new Error(`Prohibited key in meeting presentation: ${path}.${key}`);
    }
    assertNoProhibitedKeys(value[key], `${path}.${key}`, depth + 1);
  }
}

export function sanitizeMeetingPresentationDto(
  payload: Record<string, unknown>,
): MeetingPresentationDto {
  assertNoProhibitedKeys(payload);

  for (const key of Object.keys(payload)) {
    if (!(MEETING_PRESENTATION_ALLOWLIST as readonly string[]).includes(key)) {
      throw new Error(`Non-allowlisted meeting presentation key: ${key}`);
    }
  }

  const sections = payload.sections;
  if (!Array.isArray(sections)) {
    throw new Error("sections must be an array");
  }

  for (const section of sections) {
    if (!isPlainObject(section) || typeof section.sectionType !== "string") {
      throw new Error("Invalid presentation section");
    }
    assertNoProhibitedKeys(section);
  }

  return payload as unknown as MeetingPresentationDto;
}

export const EDUCATIONAL_LABEL = "Adviser-led discussion";
export const ILLUSTRATION_LABEL = "Educational illustration";
