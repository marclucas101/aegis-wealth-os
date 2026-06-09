import "server-only";

import type { BlueprintPageResults } from "@/lib/aegis/localProfile";
import type {
  AnnualReviewTimelineYear,
  WeakestPillarEntry,
} from "@/lib/supabase/moduleQueries";
import {
  loadAnnualReviewSnapshot,
  loadWealthBlueprintSnapshot,
} from "@/lib/supabase/moduleQueries";
import type {
  AWRIResult,
  ClientProfile,
  PillarScores,
  ProjectedShieldResult,
  RoadmapItem,
  ShieldRating,
  StressTestResult,
} from "@/src/lib/scoring/types";

import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";

const SCORE_VERSION = "v1";
const DEFAULT_HISTORY_LIMIT = 20;

export type RoadmapStatusSummary = {
  completed: number;
  inProgress: number;
  notStarted: number;
  total: number;
  items: Array<{
    id: string;
    title: string;
    status: RoadmapItem["status"];
    pillar: RoadmapItem["pillar"];
  }>;
};

export type PillarAnalysisSnapshot = {
  pillarScores: PillarScores;
  weakestPillars: WeakestPillarEntry[];
};

export type StressTestSummarySnapshot = {
  tests: StressTestResult[];
  topExposures: StressTestResult[];
};

export type WealthBlueprintReportData = BlueprintPageResults & {
  generatedAt: string;
  discoverScore: number;
  dataConfidenceFactor: number;
  pillarAnalysis: PillarAnalysisSnapshot;
  stressTestSummary: StressTestSummarySnapshot;
  roadmapStatusSummary: RoadmapStatusSummary;
};

export type AnnualReviewTimelinePayload = {
  years: AnnualReviewTimelineYear[];
  client: ClientProfile;
  pillarScores: PillarScores;
  roadmapStatusSummary: RoadmapStatusSummary;
};

export type PersistReportSnapshotResult = {
  id: string;
  generated_at: string;
};

export type WealthBlueprintHistoryEntry = {
  id: string;
  title: string;
  adjusted_shield_score: number | null;
  awri: number | null;
  rating: ShieldRating | null;
  generated_at: string;
};

export type AnnualReviewHistoryEntry = {
  id: string;
  review_year: number;
  review_label: string | null;
  adjusted_shield_score: number;
  rating: ShieldRating;
  generated_at: string;
};

type ShieldScoreIdRow = {
  id: string;
};

type WealthBlueprintInsertRow = {
  id: string;
  generated_at: string;
};

type AnnualReviewUpsertRow = {
  id: string;
  generated_at: string;
};

function buildRoadmapStatusSummary(roadmap: RoadmapItem[]): RoadmapStatusSummary {
  return {
    completed: roadmap.filter((item) => item.status === "completed").length,
    inProgress: roadmap.filter((item) => item.status === "in_progress").length,
    notStarted: roadmap.filter((item) => item.status === "not_started").length,
    total: roadmap.length,
    items: roadmap.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      pillar: item.pillar,
    })),
  };
}

function buildExecutiveSummaryText(
  shieldScore: number,
  rating: ShieldRating,
  awri: AWRIResult,
  improvement: number,
): string {
  const improvementText =
    improvement > 0
      ? ` Roadmap implementation is projected to improve the Adjusted Shield Score by ${improvement.toFixed(1)} points.`
      : "";

  return `Wealth Architecture Blueprint diagnostic: Adjusted Shield Score ${shieldScore.toFixed(1)} (${rating}), AWRI ${awri.awri.toFixed(1)}.${improvementText}`;
}

async function loadCurrentShieldScoreId(clientId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("shield_scores")
    .select("id")
    .eq("client_id", clientId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load current shield score: ${error.message}`);
  }

  return data ? (data as ShieldScoreIdRow).id : null;
}

function buildWealthBlueprintReportData(
  snapshot: Awaited<ReturnType<typeof loadWealthBlueprintSnapshot>> & {},
  generatedAt: string,
): WealthBlueprintReportData {
  const roadmapStatusSummary = buildRoadmapStatusSummary(snapshot.roadmap);

  return {
    shield: snapshot.shield,
    awri: snapshot.awri,
    stressTests: snapshot.stressTests,
    topStressExposures: snapshot.topStressExposures,
    roadmap: snapshot.roadmap,
    projected: snapshot.projected,
    weakestPillars: snapshot.weakestPillars,
    client: snapshot.client,
    formData: snapshot.formData,
    completedAt: snapshot.completedAt,
    generatedAt,
    discoverScore: snapshot.shield.discoverScore,
    dataConfidenceFactor: snapshot.shield.dataConfidenceFactor,
    pillarAnalysis: {
      pillarScores: snapshot.shield.pillarScores,
      weakestPillars: snapshot.weakestPillars,
    },
    stressTestSummary: {
      tests: snapshot.stressTests,
      topExposures: snapshot.topStressExposures,
    },
    roadmapStatusSummary,
  };
}

function buildAnnualReviewTimelinePayload(
  snapshot: Awaited<ReturnType<typeof loadAnnualReviewSnapshot>> & {},
): AnnualReviewTimelinePayload {
  return {
    years: snapshot.timeline,
    client: snapshot.client,
    pillarScores: snapshot.shield.pillarScores,
    roadmapStatusSummary: buildRoadmapStatusSummary(snapshot.roadmap),
  };
}

/**
 * Persists a Wealth Blueprint snapshot from the current Supabase module chain.
 */
export async function persistWealthBlueprintSnapshot(
  client: AppClientRow,
): Promise<PersistReportSnapshotResult> {
  const snapshot = await loadWealthBlueprintSnapshot(client);
  if (!snapshot) {
    throw new Error("no_profile");
  }

  const admin = createAdminSupabaseClient();
  const generatedAt = new Date().toISOString();
  const reportData = buildWealthBlueprintReportData(snapshot, generatedAt);
  const shieldScoreId = await loadCurrentShieldScoreId(client.id);
  const improvement =
    snapshot.projected.projectedAdjustedShieldScore -
    snapshot.shield.adjustedShieldScore;

  const formattedDate = new Date(generatedAt).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const { data, error } = await admin
    .from("wealth_blueprints")
    .insert({
      client_id: client.id,
      shield_score_id: shieldScoreId,
      annual_review_id: null,
      report_type: "wealth_architecture_blueprint",
      score_version: SCORE_VERSION,
      title: `Wealth Architecture Blueprint™ — ${formattedDate}`,
      executive_summary: buildExecutiveSummaryText(
        snapshot.shield.adjustedShieldScore,
        snapshot.shield.rating,
        snapshot.awri,
        improvement,
      ),
      report_data: reportData as never,
      adjusted_shield_score: snapshot.shield.adjustedShieldScore,
      awri: snapshot.awri.awri,
      rating: snapshot.shield.rating,
      generated_at: generatedAt,
    } as never)
    .select("id, generated_at")
    .single();

  if (error) {
    throw new Error(`Failed to save wealth blueprint snapshot: ${error.message}`);
  }

  const row = data as WealthBlueprintInsertRow;
  return { id: row.id, generated_at: row.generated_at };
}

/**
 * Persists an Annual Shield Review snapshot for the current calendar year.
 */
export async function persistAnnualReviewSnapshot(
  client: AppClientRow,
): Promise<PersistReportSnapshotResult> {
  const snapshot = await loadAnnualReviewSnapshot(client);
  if (!snapshot) {
    throw new Error("no_profile");
  }

  const admin = createAdminSupabaseClient();
  const generatedAt = new Date().toISOString();
  const reviewYear = new Date(generatedAt).getFullYear();
  const shieldScoreId = await loadCurrentShieldScoreId(client.id);
  const roadmapStatusSummary = buildRoadmapStatusSummary(snapshot.roadmap);
  const timelinePayload = buildAnnualReviewTimelinePayload(snapshot);

  const { data, error } = await admin
    .from("annual_reviews")
    .upsert(
      {
        client_id: client.id,
        shield_score_id: shieldScoreId,
        review_year: reviewYear,
        review_label: `${reviewYear} Annual Shield Review`,
        score_version: SCORE_VERSION,
        adjusted_shield_score: snapshot.shield.adjustedShieldScore,
        rating: snapshot.shield.rating,
        discover_score: snapshot.discoverScore,
        data_confidence_factor: snapshot.dataConfidenceFactor,
        awri: snapshot.awri.awri,
        projected_adjusted_score: snapshot.projected.projectedAdjustedShieldScore,
        total_improvement: snapshot.totalImprovement,
        timeline: timelinePayload as never,
        top_stress_exposures: snapshot.topStressExposures as never,
        weakest_pillars: snapshot.weakestPillars as never,
        actions_completed: roadmapStatusSummary.completed,
        actions_total: roadmapStatusSummary.total,
        generated_at: generatedAt,
      } as never,
      { onConflict: "client_id,review_year" },
    )
    .select("id, generated_at")
    .single();

  if (error) {
    throw new Error(`Failed to save annual review snapshot: ${error.message}`);
  }

  const row = data as AnnualReviewUpsertRow;
  return { id: row.id, generated_at: row.generated_at };
}

/**
 * Returns recent saved Wealth Blueprint snapshots for the authenticated client.
 */
export async function loadWealthBlueprintHistory(
  client: AppClientRow,
  limit = DEFAULT_HISTORY_LIMIT,
): Promise<WealthBlueprintHistoryEntry[]> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("wealth_blueprints")
    .select("id, title, adjusted_shield_score, awri, rating, generated_at")
    .eq("client_id", client.id)
    .eq("report_type", "wealth_architecture_blueprint")
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to load wealth blueprint history: ${error.message}`,
    );
  }

  return (data ?? []) as WealthBlueprintHistoryEntry[];
}

/**
 * Returns recent saved Annual Review snapshots for the authenticated client.
 */
export async function loadAnnualReviewHistory(
  client: AppClientRow,
  limit = DEFAULT_HISTORY_LIMIT,
): Promise<AnnualReviewHistoryEntry[]> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("annual_reviews")
    .select(
      "id, review_year, review_label, adjusted_shield_score, rating, generated_at",
    )
    .eq("client_id", client.id)
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load annual review history: ${error.message}`);
  }

  return (data ?? []) as AnnualReviewHistoryEntry[];
}
