import "server-only";

import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";
import type { PublishedOutputType } from "@/lib/compliance/types";
import { loadClientSafeRoadmap } from "@/lib/compliance/clientRoadmapData";
import {
  sanitizeClientPlanSummary,
} from "@/lib/compliance/clientSafeDtos";
import { prepareClientSafeOutput } from "@/lib/compliance/publicationWorkflow";
import { listClientGoals } from "@/lib/supabase/clientGoalsPersistence";
import { loadDashboardSnapshot } from "@/lib/supabase/dashboardQueries";
import { dbLoadAdviserDisplayName } from "@/lib/supabase/meetingSessionPersistence";
import type { AppClientRow } from "@/lib/supabase/userProfile";

export const PLANNING_OUTPUT_PREPARE_ALLOWLIST: PublishedOutputType[] = [
  "financial_readiness_snapshot",
  "financial_overview",
  "client_plan_summary",
  "goal_plan_summary",
  "roadmap_summary",
];

export function isPlanningOutputPrepareAllowed(
  outputType: PublishedOutputType,
): outputType is (typeof PLANNING_OUTPUT_PREPARE_ALLOWLIST)[number] {
  return (PLANNING_OUTPUT_PREPARE_ALLOWLIST as readonly string[]).includes(outputType);
}

export async function preparePlanningOutputFromSources(input: {
  client: AppClientRow;
  outputType: PublishedOutputType;
  actorUserId: string;
}) {
  if (!isPlanningOutputPrepareAllowed(input.outputType)) {
    throw new Error("Output type is not supported for adviser preparation");
  }

  if (
    input.outputType === "financial_readiness_snapshot" ||
    input.outputType === "financial_overview"
  ) {
    const snapshot = await loadDashboardSnapshot(input.client);
    if (!snapshot) {
      throw new Error("Client has no analysis to prepare");
    }

    return prepareClientSafeOutput({
      clientId: input.client.id,
      outputType: input.outputType,
      actorUserId: input.actorUserId,
      internalContext: {
        rating: snapshot.shield?.rating ?? null,
        strongestPillar: snapshot.insights?.strongestPillar ?? null,
        weakestPillar: snapshot.insights?.weakestPillar ?? null,
        informationCompletenessPercent: (snapshot.dataConfidenceFactor ?? 0.5) * 100,
        dataAsAt: snapshot.completedAt,
        hasAssignedAdviser: Boolean(input.client.advisor_user_id),
      },
      sourceInputVersion: snapshot.completedAt,
      algorithmVersion: "phase9f3-v1",
    });
  }

  const adviserName = await dbLoadAdviserDisplayName(input.client.advisor_user_id ?? input.actorUserId);

  if (input.outputType === "roadmap_summary") {
    const roadmap = await loadClientSafeRoadmap(input.client);
    const priorities = [
      ...roadmap.clientActions.map((item) => item.title),
      ...roadmap.adviserActions.map((item) => item.title),
    ].slice(0, 8);

    if (priorities.length === 0) {
      throw new Error("Client has no roadmap actions to prepare");
    }

    const safePayload = sanitizeClientPlanSummary({
      title: "Wealth roadmap",
      planningObjectives: [],
      agreedPriorities: priorities,
      adviserObservations: [],
      keyAssumptions: [],
      strategySummary: `Roadmap progress: ${roadmap.progressPercent}% complete.`,
      protectionOverview: "",
      goalDirection: [],
      agreedActions: priorities,
      nextReviewDate: input.client.next_review_due,
      dataAsAt: roadmap.dataAsAt ?? new Date().toISOString(),
      adviserName,
      publicationStatus: "current",
      educationalExplanation: CLIENT_TERMINOLOGY.basedOnInformationProvided,
    });

    return prepareClientSafeOutput({
      clientId: input.client.id,
      outputType: input.outputType,
      actorUserId: input.actorUserId,
      audience: "client_published",
      internalContext: {
        rating: null,
        strongestPillar: null,
        weakestPillar: null,
        informationCompletenessPercent: roadmap.progressPercent,
        dataAsAt: roadmap.dataAsAt ?? new Date().toISOString(),
        hasAssignedAdviser: Boolean(input.client.advisor_user_id),
      },
      sourceInputVersion: roadmap.dataAsAt ?? new Date().toISOString(),
      algorithmVersion: "phase9f3-v1",
      safePayloadOverride: safePayload as unknown as Record<string, unknown>,
    });
  }

  const snapshot = await loadDashboardSnapshot(input.client);
  if (!snapshot) {
    throw new Error("Client has no analysis to prepare");
  }

  const goals = await listClientGoals(input.client.id).catch(() => []);
  const roadmapTitles = snapshot.roadmap.slice(0, 5).map((item) => item.title);
  const goalTitles = goals.slice(0, 5).map((goal) => goal.title);

  const agreedPriorities =
    input.outputType === "goal_plan_summary"
      ? goalTitles.length > 0
        ? goalTitles
        : roadmapTitles
      : roadmapTitles;

  const safePayload = sanitizeClientPlanSummary({
    title:
      input.outputType === "goal_plan_summary"
        ? "Agreed priorities"
        : "Current planning position",
    planningObjectives: roadmapTitles,
    agreedPriorities,
    adviserObservations: [],
    keyAssumptions: [
      `Shield rating ${snapshot.shield.rating.replace(/_/g, " ")}.`,
    ],
    strategySummary: `Planning focus on ${snapshot.insights.weakestPillar.replace(/_/g, " ")}.`,
    protectionOverview: `Protection core score ${Math.round(snapshot.protectionCore.aggregateScore ?? 0)}.`,
    goalDirection: goalTitles,
    agreedActions: agreedPriorities.slice(0, 5),
    nextReviewDate: input.client.next_review_due,
    dataAsAt: snapshot.completedAt,
    adviserName,
    publicationStatus: "current",
    educationalExplanation: CLIENT_TERMINOLOGY.basedOnInformationProvided,
  });

  return prepareClientSafeOutput({
    clientId: input.client.id,
    outputType: input.outputType,
    actorUserId: input.actorUserId,
    audience: "client_published",
    internalContext: {
      rating: snapshot.shield.rating,
      strongestPillar: snapshot.insights.strongestPillar,
      weakestPillar: snapshot.insights.weakestPillar,
      informationCompletenessPercent: (snapshot.dataConfidenceFactor ?? 0.5) * 100,
      dataAsAt: snapshot.completedAt,
      hasAssignedAdviser: Boolean(input.client.advisor_user_id),
    },
    sourceInputVersion: snapshot.completedAt,
    algorithmVersion: "phase9f3-v1",
    safePayloadOverride: safePayload as unknown as Record<string, unknown>,
  });
}
