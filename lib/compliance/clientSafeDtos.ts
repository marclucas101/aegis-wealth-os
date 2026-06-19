import type { ShieldRating } from "@/src/lib/scoring/types";

import { CLIENT_TERMINOLOGY } from "./terminology";
import type {
  ClientSafeAccessMode,
  ClientSafeFallbackReason,
  PublishedOutputType,
} from "./types";

/** Allowlisted keys for financial_readiness_snapshot safe payloads. */
export const FINANCIAL_READINESS_SNAPSHOT_ALLOWLIST = [
  "readinessBand",
  "broadStrengths",
  "areasForAdviserReview",
  "informationCompletenessPercent",
  "educationalExplanation",
  "dataAsAt",
  "adviserReviewStatus",
  "lastReviewedDate",
  "nextRecommendedAdministrativeStep",
  "appointmentCta",
  "missingInformationCategories",
] as const;

const VALID_READINESS_BANDS = new Set([
  "early_exploration",
  "building_foundation",
  "moderate_readiness",
  "strong_foundation",
  "comprehensive",
]);

const VALID_REVIEW_STATUSES = new Set([
  "pending",
  "in_progress",
  "reviewed",
  "published",
]);

export type FinancialReadinessBand =
  | "early_exploration"
  | "building_foundation"
  | "moderate_readiness"
  | "strong_foundation"
  | "comprehensive";

export type ClientSafeFinancialReadinessSnapshot = {
  readinessBand: FinancialReadinessBand;
  broadStrengths: string[];
  areasForAdviserReview: string[];
  informationCompletenessPercent: number;
  educationalExplanation: string;
  dataAsAt: string;
  adviserReviewStatus: "pending" | "in_progress" | "reviewed" | "published";
  lastReviewedDate: string | null;
  nextRecommendedAdministrativeStep: string;
  appointmentCta: { label: string; href: string } | null;
  missingInformationCategories: string[];
};

export type ClientSafeEnvelope<T> = {
  accessMode: ClientSafeAccessMode;
  outputType: PublishedOutputType;
  fallbackReason?: ClientSafeFallbackReason;
  fallbackMessage?: string;
  publishedAt?: string | null;
  stale?: boolean;
  reviewRecommended?: boolean;
  data: T | null;
};

const PROHIBITED_PAYLOAD_KEYS = new Set([
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
  "assetAllocation",
  "internalNotes",
  "adviserNotes",
  "modelCoefficients",
  "weightings",
  "stressTests",
  "roadmap",
  "awri",
  "benchmark",
  "projected",
  "formData",
  "discoverScore",
  "rawInternalScore",
  "__proto__",
  "constructor",
  "prototype",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertNoProhibitedKeysDeep(
  value: unknown,
  path = "payload",
  depth = 0,
): void {
  if (depth > 4) {
    throw new Error(`Nested payload too deep at ${path}`);
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertNoProhibitedKeysDeep(value[i], `${path}[${i}]`, depth + 1);
    }
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    if (PROHIBITED_PAYLOAD_KEYS.has(key)) {
      throw new Error(`Prohibited key in client-safe payload: ${path}.${key}`);
    }
    assertNoProhibitedKeysDeep(value[key], `${path}.${key}`, depth + 1);
  }
}

function parseAppointmentCta(
  value: unknown,
): ClientSafeFinancialReadinessSnapshot["appointmentCta"] {
  if (value === null) {
    return null;
  }
  if (!isPlainObject(value)) {
    throw new Error("Invalid appointmentCta: must be object or null");
  }
  const allowedCtaKeys = new Set(["label", "href"]);
  for (const key of Object.keys(value)) {
    if (!allowedCtaKeys.has(key)) {
      throw new Error(`Non-allowlisted appointmentCta key: ${key}`);
    }
  }
  if (typeof value.label !== "string" || typeof value.href !== "string") {
    throw new Error("Invalid appointmentCta: label and href required");
  }
  if (!value.href.startsWith("/")) {
    throw new Error("Invalid appointmentCta href");
  }
  return { label: value.label, href: value.href };
}

function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${field}: must be array`);
  }
  for (const item of value) {
    if (typeof item !== "string") {
      throw new Error(`Invalid ${field}: all entries must be strings`);
    }
  }
  return value;
}

function ratingToReadinessBand(rating: ShieldRating | null): FinancialReadinessBand {
  switch (rating) {
    case "AAA":
    case "AA":
      return "comprehensive";
    case "A":
      return "strong_foundation";
    case "BBB":
      return "moderate_readiness";
    case "BB":
      return "building_foundation";
    default:
      return "early_exploration";
  }
}

function pillarLabel(pillar: string): string {
  const labels: Record<string, string> = {
    foundation: "Foundation planning",
    protect: "Protection planning",
    grow: "Growth planning",
    optimise: "Optimisation planning",
    transition: "Transition planning",
    preserve: "Preservation planning",
    legacy: "Legacy planning",
  };
  return labels[pillar] ?? "Planning category";
}

/**
 * Constructs a client-safe Financial Readiness Snapshot from internal analysis.
 * Builds from explicit fields only — never spreads internal objects.
 */
export function buildFinancialReadinessSnapshotFromInternal(input: {
  rating: ShieldRating | null;
  strongestPillar: string | null;
  weakestPillar: string | null;
  informationCompletenessPercent: number;
  dataAsAt: string;
  missingCategories?: string[];
  hasAssignedAdviser?: boolean;
}): ClientSafeFinancialReadinessSnapshot {
  const broadStrengths: string[] = [];
  const areasForAdviserReview: string[] = [];

  if (input.strongestPillar) {
    broadStrengths.push(
      `${CLIENT_TERMINOLOGY.broadStrength}: ${pillarLabel(input.strongestPillar)}`,
    );
  }

  if (input.weakestPillar) {
    areasForAdviserReview.push(
      `${CLIENT_TERMINOLOGY.areaForAdviserReview}: ${pillarLabel(input.weakestPillar)}`,
    );
  }

  if (input.informationCompletenessPercent < 80) {
    areasForAdviserReview.push(
      "Additional information may help your adviser prepare for review",
    );
  }

  return {
    readinessBand: ratingToReadinessBand(input.rating),
    broadStrengths,
    areasForAdviserReview,
    informationCompletenessPercent: Math.round(input.informationCompletenessPercent),
    educationalExplanation:
      `${CLIENT_TERMINOLOGY.basedOnInformationProvided}. ` +
      "This snapshot provides broad planning categories only and does not constitute personal advice.",
    dataAsAt: input.dataAsAt,
    adviserReviewStatus: "pending",
    lastReviewedDate: null,
    nextRecommendedAdministrativeStep: input.hasAssignedAdviser
      ? "Schedule or attend your adviser review appointment"
      : "Complete your information and connect with an adviser",
    appointmentCta: input.hasAssignedAdviser
      ? { label: "View appointments", href: "/my-adviser" }
      : null,
    missingInformationCategories: input.missingCategories ?? [],
  };
}

/**
 * Validates stored safe payload using explicit allowlist construction.
 * Rejects unknown keys, prohibited nested keys, and non-plain objects.
 */
export function sanitizeFinancialReadinessPayload(
  payload: Record<string, unknown>,
): ClientSafeFinancialReadinessSnapshot {
  if (!isPlainObject(payload)) {
    throw new Error("Client-safe payload must be a plain object");
  }

  assertNoProhibitedKeysDeep(payload);

  const allowed = new Set<string>(FINANCIAL_READINESS_SNAPSHOT_ALLOWLIST);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      throw new Error(`Non-allowlisted key in client-safe payload: ${key}`);
    }
  }

  if (typeof payload.readinessBand !== "string" || !VALID_READINESS_BANDS.has(payload.readinessBand)) {
    throw new Error("Invalid financial readiness payload: readinessBand required");
  }

  const broadStrengths = parseStringArray(
    payload.broadStrengths ?? [],
    "broadStrengths",
  );
  const areasForAdviserReview = parseStringArray(
    payload.areasForAdviserReview ?? [],
    "areasForAdviserReview",
  );
  const missingInformationCategories = parseStringArray(
    payload.missingInformationCategories ?? [],
    "missingInformationCategories",
  );

  if (typeof payload.informationCompletenessPercent !== "number") {
    throw new Error("Invalid informationCompletenessPercent");
  }
  if (typeof payload.educationalExplanation !== "string") {
    throw new Error("Invalid educationalExplanation");
  }
  if (typeof payload.dataAsAt !== "string") {
    throw new Error("Invalid dataAsAt");
  }
  if (
    typeof payload.adviserReviewStatus !== "string" ||
    !VALID_REVIEW_STATUSES.has(payload.adviserReviewStatus)
  ) {
    throw new Error("Invalid adviserReviewStatus");
  }
  if (
    payload.lastReviewedDate !== null &&
    typeof payload.lastReviewedDate !== "string"
  ) {
    throw new Error("Invalid lastReviewedDate");
  }
  if (typeof payload.nextRecommendedAdministrativeStep !== "string") {
    throw new Error("Invalid nextRecommendedAdministrativeStep");
  }

  const appointmentCta = parseAppointmentCta(
    payload.appointmentCta === undefined ? null : payload.appointmentCta,
  );

  return {
    readinessBand: payload.readinessBand as FinancialReadinessBand,
    broadStrengths,
    areasForAdviserReview,
    informationCompletenessPercent: Math.round(payload.informationCompletenessPercent),
    educationalExplanation: payload.educationalExplanation,
    dataAsAt: payload.dataAsAt,
    adviserReviewStatus: payload.adviserReviewStatus as ClientSafeFinancialReadinessSnapshot["adviserReviewStatus"],
    lastReviewedDate: payload.lastReviewedDate as string | null,
    nextRecommendedAdministrativeStep: payload.nextRecommendedAdministrativeStep,
    appointmentCta,
    missingInformationCategories,
  };
}

export function wrapClientSafeResponse<T>(
  outputType: PublishedOutputType,
  data: T | null,
  options: {
    accessMode: ClientSafeAccessMode;
    fallbackReason?: ClientSafeFallbackReason;
    fallbackMessage?: string;
    publishedAt?: string | null;
    stale?: boolean;
    reviewRecommended?: boolean;
  },
): ClientSafeEnvelope<T> {
  return {
    accessMode: options.accessMode,
    outputType,
    fallbackReason: options.fallbackReason,
    fallbackMessage: options.fallbackMessage,
    publishedAt: options.publishedAt ?? null,
    data,
    ...(options.stale !== undefined ? { stale: options.stale } : {}),
    ...(options.reviewRecommended !== undefined
      ? { reviewRecommended: options.reviewRecommended }
      : {}),
  };
}

/** Allowlisted keys for client_plan_summary and related plan outputs. */
export const CLIENT_PLAN_SUMMARY_ALLOWLIST = [
  "title",
  "planningObjectives",
  "agreedPriorities",
  "adviserObservations",
  "keyAssumptions",
  "strategySummary",
  "protectionOverview",
  "goalDirection",
  "agreedActions",
  "nextReviewDate",
  "dataAsAt",
  "adviserName",
  "publicationStatus",
  "educationalExplanation",
] as const;

export type ClientSafePlanSummary = {
  title: string;
  planningObjectives: string[];
  agreedPriorities: string[];
  adviserObservations: string[];
  keyAssumptions: string[];
  strategySummary: string;
  protectionOverview: string;
  goalDirection: string[];
  agreedActions: string[];
  nextReviewDate: string | null;
  dataAsAt: string;
  adviserName: string | null;
  publicationStatus: "current" | "superseded";
  educationalExplanation: string;
};

export type ClientSafePublishedSummary = {
  id: string;
  outputType: PublishedOutputType;
  title: string;
  publishedAt: string | null;
  dataAsAt: string | null;
  adviserName: string | null;
  publicationStatus: "current" | "superseded" | "stale";
  staleMessage: string | null;
  payload: ClientSafePlanSummary | ClientSafeFinancialReadinessSnapshot | Record<string, unknown>;
};

export type ClientSafeMeetingSummary = {
  title: string;
  meetingDate: string | null;
  summaryPoints: string[];
  agreedActions: string[];
  nextSteps: string[];
  dataAsAt: string;
  adviserName: string | null;
  educationalExplanation: string;
};

const MEETING_SUMMARY_ALLOWLIST = new Set([
  "title",
  "meetingDate",
  "summaryPoints",
  "agreedActions",
  "nextSteps",
  "dataAsAt",
  "adviserName",
  "educationalExplanation",
]);

export function sanitizeClientPlanSummary(
  payload: Record<string, unknown>,
): ClientSafePlanSummary {
  assertNoProhibitedKeysDeep(payload);
  const allowed = new Set<string>(CLIENT_PLAN_SUMMARY_ALLOWLIST);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      throw new Error(`Non-allowlisted key in plan summary: ${key}`);
    }
  }

  const parseStrings = (field: string): string[] => {
    const value = payload[field];
    if (value === undefined) return [];
    return parseStringArray(value, field);
  };

  return {
    title: typeof payload.title === "string" ? payload.title : "My Plan",
    planningObjectives: parseStrings("planningObjectives"),
    agreedPriorities: parseStrings("agreedPriorities"),
    adviserObservations: parseStrings("adviserObservations"),
    keyAssumptions: parseStrings("keyAssumptions"),
    strategySummary:
      typeof payload.strategySummary === "string" ? payload.strategySummary : "",
    protectionOverview:
      typeof payload.protectionOverview === "string"
        ? payload.protectionOverview
        : "",
    goalDirection: parseStrings("goalDirection"),
    agreedActions: parseStrings("agreedActions"),
    nextReviewDate:
      payload.nextReviewDate === null || typeof payload.nextReviewDate === "string"
        ? (payload.nextReviewDate as string | null)
        : null,
    dataAsAt: typeof payload.dataAsAt === "string" ? payload.dataAsAt : new Date().toISOString(),
    adviserName:
      payload.adviserName === null || typeof payload.adviserName === "string"
        ? (payload.adviserName as string | null)
        : null,
    publicationStatus:
      payload.publicationStatus === "superseded" ? "superseded" : "current",
    educationalExplanation:
      typeof payload.educationalExplanation === "string"
        ? payload.educationalExplanation
        : CLIENT_TERMINOLOGY.basedOnInformationProvided,
  };
}

export function sanitizeMeetingSummaryPayload(
  payload: Record<string, unknown>,
): ClientSafeMeetingSummary {
  assertNoProhibitedKeysDeep(payload);
  for (const key of Object.keys(payload)) {
    if (!MEETING_SUMMARY_ALLOWLIST.has(key)) {
      throw new Error(`Non-allowlisted key in meeting summary: ${key}`);
    }
  }

  return {
    title: typeof payload.title === "string" ? payload.title : "Meeting summary",
    meetingDate:
      payload.meetingDate === null || typeof payload.meetingDate === "string"
        ? (payload.meetingDate as string | null)
        : null,
    summaryPoints: parseStringArray(payload.summaryPoints ?? [], "summaryPoints"),
    agreedActions: parseStringArray(payload.agreedActions ?? [], "agreedActions"),
    nextSteps: parseStringArray(payload.nextSteps ?? [], "nextSteps"),
    dataAsAt: typeof payload.dataAsAt === "string" ? payload.dataAsAt : new Date().toISOString(),
    adviserName:
      payload.adviserName === null || typeof payload.adviserName === "string"
        ? (payload.adviserName as string | null)
        : null,
    educationalExplanation:
      typeof payload.educationalExplanation === "string"
        ? payload.educationalExplanation
        : CLIENT_TERMINOLOGY.adviserReviewedSummary,
  };
}
