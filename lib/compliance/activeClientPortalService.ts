import "server-only";

import {
  sanitizeClientPlanSummary,
  sanitizeFinancialReadinessPayload,
  sanitizeMeetingSummaryPayload,
  wrapClientSafeResponse,
  type ClientSafeEnvelope,
  type ClientSafeFinancialReadinessSnapshot,
  type ClientSafePlanSummary,
  type ClientSafePublishedSummary,
} from "@/lib/compliance/clientSafeDtos";
import { loadClientSafeRoadmap } from "@/lib/compliance/clientRoadmapData";
import { resolveFallbackState } from "@/lib/compliance/fallbackStates";
import {
  loadLatestReviewSubmissionStatus,
  type ReviewSubmissionType,
} from "@/lib/compliance/goalsReviewSubmission";
import { loadActiveClientPortalShell } from "@/lib/compliance/activeClientPortalData";
import { assertMeetingSummaryPublicationEnabled } from "@/lib/compliance/meetingStudioAccess";
import {
  listPublishedOutputsForClient,
  loadCurrentPublishedOutput,
  parsePublishedSafePayload,
} from "@/lib/compliance/publicationWorkflow";
import { filterPublicationsForOutputTypes } from "@/lib/compliance/publicationSelection";
import { resolveRelationshipStage } from "@/lib/compliance/relationshipStage";
import { assessOutputStaleness } from "@/lib/compliance/staleOutputPolicy";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";
import type { PublishedOutputType } from "@/lib/compliance/types";
import { loadCurrentDiscoverProfile } from "@/lib/supabase/discoverPersistence";
import { listClientGoals } from "@/lib/supabase/clientGoalsPersistence";
import type { AppClientRow, AppUserRow } from "@/lib/supabase/userProfile";

const MY_PLAN_OUTPUT_TYPES: PublishedOutputType[] = [
  "client_plan_summary",
  "financial_overview",
  "meeting_summary",
  "annual_review_summary",
  "goal_plan_summary",
  "wealth_blueprint_summary",
];

export async function loadActiveClientFinancialOverview(input: {
  user: AppUserRow;
  client: AppClientRow;
}): Promise<{
  shell: Awaited<ReturnType<typeof loadActiveClientPortalShell>>;
  overview: ClientSafeEnvelope<ClientSafeFinancialReadinessSnapshot | null>;
  roadmapProgressPercent: number;
  goalCount: number;
}> {
  const shell = await loadActiveClientPortalShell(input);
  const stage = resolveRelationshipStage(input.client);
  const discover = await loadCurrentDiscoverProfile(input.client.id);

  const published = await loadCurrentPublishedOutput(
    input.client.id,
    "financial_overview",
    "client_published",
  );

  let overview: ClientSafeEnvelope<ClientSafeFinancialReadinessSnapshot | null>;

  if (published) {
    const payload = parsePublishedSafePayload(published);
    const stale = assessOutputStaleness({
      outputType: "financial_overview",
      dataAsAt: payload.dataAsAt,
      publishedAt: published.published_at,
      expiresAt: published.expires_at,
    });

    overview = wrapClientSafeResponse("financial_overview", payload, {
      accessMode: "published",
      publishedAt: published.published_at,
      stale: stale.isStale,
      reviewRecommended: stale.reviewRecommended,
      fallbackMessage: stale.staleMessage ?? undefined,
    });
  } else {
    const fallback = resolveFallbackState({
      stage,
      hasDiscoverData: Boolean(discover?.formData),
      hasAssignedAdviser: Boolean(input.client.advisor_user_id),
      hasPublishedSummary: false,
    });

    overview = wrapClientSafeResponse("financial_overview", null, {
      accessMode: "fallback",
      fallbackReason: fallback.reason,
      fallbackMessage:
        stage === "active_client"
          ? CLIENT_TERMINOLOGY.adviserPreparingUpdate
          : fallback.message,
    });
  }

  const roadmap = await loadClientSafeRoadmap(input.client);
  const goals = await listClientGoals(input.client.id).catch(() => []);

  return {
    shell,
    overview,
    roadmapProgressPercent: roadmap.progressPercent,
    goalCount: goals.length,
  };
}

export async function loadMyPlanPublications(
  clientId: string,
): Promise<ClientSafePublishedSummary[]> {
  const rows = await listPublishedOutputsForClient(clientId);
  const currentRows = filterPublicationsForOutputTypes(rows, MY_PLAN_OUTPUT_TYPES);

  return currentRows.map((row) => {
    let payload: ClientSafePlanSummary | ClientSafeFinancialReadinessSnapshot | Record<string, unknown>;

    if (
      row.output_type === "financial_overview" ||
      row.output_type === "financial_readiness_snapshot"
    ) {
      payload = sanitizeFinancialReadinessPayload(row.safe_payload);
    } else if (row.output_type === "meeting_summary") {
      payload = sanitizeMeetingSummaryPayload(row.safe_payload);
    } else {
      payload = sanitizeClientPlanSummary(row.safe_payload);
    }

    const dataAsAt =
      typeof payload === "object" &&
      payload !== null &&
      "dataAsAt" in payload &&
      typeof payload.dataAsAt === "string"
        ? payload.dataAsAt
        : row.published_at;

    const stale = assessOutputStaleness({
      outputType: row.output_type,
      dataAsAt: dataAsAt ?? null,
      publishedAt: row.published_at,
      expiresAt: row.expires_at,
    });

    const title =
      typeof payload === "object" &&
      payload !== null &&
      "title" in payload &&
      typeof payload.title === "string"
        ? payload.title
        : outputTypeLabel(row.output_type);

    return {
      id: row.id,
      outputType: row.output_type,
      title,
      publishedAt: row.published_at,
      dataAsAt: dataAsAt ?? null,
      adviserName:
        typeof payload === "object" &&
        payload !== null &&
        "adviserName" in payload &&
        (payload.adviserName === null || typeof payload.adviserName === "string")
          ? (payload.adviserName as string | null)
          : null,
      publicationStatus: stale.isStale ? "stale" : "current",
      staleMessage: stale.staleMessage,
      payload,
    };
  });
}

function outputTypeLabel(type: PublishedOutputType): string {
  const labels: Partial<Record<PublishedOutputType, string>> = {
    client_plan_summary: "Plan summary",
    financial_overview: CLIENT_TERMINOLOGY.financialOverview,
    meeting_summary: "Meeting summary",
    annual_review_summary: "Annual review summary",
    goal_plan_summary: "Goal plan summary",
    wealth_blueprint_summary: "Plan summary",
  };
  return labels[type] ?? "Adviser-reviewed summary";
}

export async function loadPublishedMeetingSummaries(
  clientId: string,
): Promise<ClientSafePublishedSummary[]> {
  await assertMeetingSummaryPublicationEnabled().catch(() => {
    return undefined;
  });

  const meetingEnabled = await import("@/lib/compliance/featureFlags").then((m) =>
    m.isFeatureEnabled("meeting_summary_publication"),
  );

  if (!meetingEnabled) {
    return [];
  }

  const row = await loadCurrentPublishedOutput(
    clientId,
    "meeting_summary",
    "client_published",
  );

  if (!row) {
    return [];
  }

  const payload = sanitizeMeetingSummaryPayload(row.safe_payload);
  const stale = assessOutputStaleness({
    outputType: "meeting_summary",
    dataAsAt: payload.dataAsAt,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
  });

  return [
    {
      id: row.id,
      outputType: "meeting_summary",
      title: payload.title,
      publishedAt: row.published_at,
      dataAsAt: payload.dataAsAt,
      adviserName: payload.adviserName,
      publicationStatus: stale.isStale ? "stale" : "current",
      staleMessage: stale.staleMessage,
      payload,
    },
  ];
}

export async function loadGoalsReviewsPortalData(input: {
  client: AppClientRow;
}): Promise<{
  goals: Awaited<ReturnType<typeof listClientGoals>>;
  reviewStatus: Awaited<ReturnType<typeof loadLatestReviewSubmissionStatus>>;
  publishedSummaries: ClientSafePublishedSummary[];
}> {
  const goals = await listClientGoals(input.client.id).catch(() => []);
  const reviewStatus = await loadLatestReviewSubmissionStatus(input.client.id).catch(
    () => ({ pending: false, submissionType: null as ReviewSubmissionType | null }),
  );

  const summaries = await loadMyPlanPublications(input.client.id);
  const reviewSummaries = summaries.filter(
    (s) =>
      s.outputType === "annual_review_summary" || s.outputType === "goal_plan_summary",
  );

  return {
    goals,
    reviewStatus,
    publishedSummaries: reviewSummaries,
  };
}
