/**
 * Phase 9D client-safe DTO negative tests — all publication output types.
 * Invoked from run-phase9d-client-portal-validation.ts
 */

import {
  buildFinancialReadinessSnapshotFromInternal,
  sanitizeClientPlanSummary,
  sanitizeFinancialReadinessPayload,
  sanitizeMeetingSummaryPayload,
} from "../lib/compliance/clientSafeDtos";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function expectThrow(fn: () => void, label: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, label);
}

const BASE_READINESS: Record<string, unknown> = {
  readinessBand: "moderate_readiness",
  broadStrengths: [],
  areasForAdviserReview: [],
  informationCompletenessPercent: 50,
  educationalExplanation: "test",
  dataAsAt: "2026-06-20",
  adviserReviewStatus: "published",
  lastReviewedDate: null,
  nextRecommendedAdministrativeStep: "step",
  appointmentCta: null,
  missingInformationCategories: [],
};

const BASE_PLAN: Record<string, unknown> = {
  title: "My Plan",
  planningObjectives: ["Retirement planning"],
  agreedPriorities: ["Cash flow review"],
  adviserObservations: ["Based on information provided"],
  keyAssumptions: ["Employment continues"],
  strategySummary: "Broad strategy summary for discussion.",
  protectionOverview: "Protection overview for discussion.",
  goalDirection: ["Build emergency fund"],
  agreedActions: ["Complete annual review"],
  nextReviewDate: "2027-01-01",
  dataAsAt: "2026-06-20",
  adviserName: "Adviser",
  publicationStatus: "current",
  educationalExplanation: "Educational illustration only.",
};

const BASE_MEETING: Record<string, unknown> = {
  title: "Meeting summary",
  meetingDate: "2026-06-15",
  summaryPoints: ["Discussed cash flow"],
  agreedActions: ["Upload statement"],
  nextSteps: ["Schedule follow-up"],
  dataAsAt: "2026-06-20",
  adviserName: "Adviser",
  educationalExplanation: "Adviser-reviewed summary",
};

export function runPhase9dClientSafeDtoNegativeTests(): void {
  const safe = buildFinancialReadinessSnapshotFromInternal({
    rating: "BBB",
    strongestPillar: "foundation",
    weakestPillar: "protect",
    informationCompletenessPercent: 72,
    dataAsAt: "2026-06-20",
    hasAssignedAdviser: true,
  });

  const sanitized = sanitizeFinancialReadinessPayload(
    safe as unknown as Record<string, unknown>,
  );
  assert(!("shield" in sanitized), "financial overview: no shield in DTO");

  expectThrow(
    () =>
      sanitizeFinancialReadinessPayload({
        ...BASE_READINESS,
        rawShieldScore: 90,
      } as Record<string, unknown>),
    "financial overview: prohibited top-level key rejected",
  );

  expectThrow(
    () =>
      sanitizeFinancialReadinessPayload({
        ...BASE_READINESS,
        broadStrengths: [{ pillarScores: { protect: 90 } }],
      } as Record<string, unknown>),
    "financial overview: prohibited nested key rejected",
  );

  expectThrow(
    () =>
      sanitizeClientPlanSummary({
        ...BASE_PLAN,
        productName: "Whole life",
      } as Record<string, unknown>),
    "client plan: prohibited key rejected",
  );

  expectThrow(
    () =>
      sanitizeClientPlanSummary({
        ...BASE_PLAN,
        agreedPriorities: ["Buy product X"],
        internalNotes: "hidden",
      } as Record<string, unknown>),
    "client plan: nested prohibited key rejected",
  );

  expectThrow(
    () =>
      sanitizeMeetingSummaryPayload({
        ...BASE_MEETING,
        acknowledgementDetails: { accepted: true },
      } as Record<string, unknown>),
    "meeting summary: acknowledgement details rejected",
  );

  expectThrow(
    () =>
      sanitizeMeetingSummaryPayload({
        ...BASE_MEETING,
        summaryPoints: ["ok", { stressTests: [] }],
      } as unknown as Record<string, unknown>),
    "meeting summary: nested object in summaryPoints rejected",
  );

  const validPlan = sanitizeClientPlanSummary(BASE_PLAN);
  assert(validPlan.title === "My Plan", "client plan: valid payload accepted");

  const validMeeting = sanitizeMeetingSummaryPayload(BASE_MEETING);
  assert(validMeeting.title === "Meeting summary", "meeting summary: valid payload accepted");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runPhase9dClientSafeDtoNegativeTests();
  console.log("Phase 9D client-safe DTO negative tests passed.");
}
