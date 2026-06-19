import "server-only";

import {
  buildClientFinancialProfile,
  computeDashboardFromProfile,
  computeRoadmapFromProfile,
  refreshDiscoverScores,
  type DiscoverStoredProfile,
  type RoadmapItemStatus,
  type SaveDiscoverProfileInput,
} from "@/lib/aegis/localProfile";
import { SHIELD_PILLAR_WEIGHTS } from "@/src/lib/scoring/constants";
import type {
  RoadmapItem,
  ShieldPillar,
  ShieldRating,
} from "@/src/lib/scoring/types";

import { syncClientDateOfBirthFromDiscover } from "./birthdayReminderTasks";
import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";
import { parseDateOfBirth } from "@/src/lib/advisor/birthdayCalculation";

const SCORE_VERSION = "v1";

export type PersistDiscoverInput = SaveDiscoverProfileInput & {
  completedAt?: string;
  /** Optional local roadmap statuses (e.g. from localStorage) merged with DB state. */
  roadmapStatuses?: Record<string, RoadmapItemStatus>;
};

export type PersistDiscoverResult = {
  discoverProfileId: string;
  financialProfileId: string;
  shieldScoreId: string;
  clientId: string;
  adjustedShieldScore: number;
  rating: ShieldRating;
};

export type CurrentDiscoverProfile = DiscoverStoredProfile & {
  id: string;
  clientId: string;
};

type RoadmapStatusRow = {
  item_key: string;
  status: RoadmapItemStatus;
  started_at: string | null;
  completed_at: string | null;
};

function toStoredProfile(
  input: PersistDiscoverInput,
): DiscoverStoredProfile {
  return refreshDiscoverScores({
    version: 1,
    completedAt: input.completedAt ?? new Date().toISOString(),
    formData: input.formData,
    completeness: input.completeness,
    discoverScore: input.discoverScore,
    dataConfidenceFactor: input.dataConfidenceFactor,
  });
}

function roadmapStatusTimestamps(
  status: RoadmapItemStatus,
  existing?: Pick<RoadmapStatusRow, "started_at" | "completed_at">,
): { started_at: string | null; completed_at: string | null } {
  const now = new Date().toISOString();

  if (status === "completed") {
    return {
      started_at: existing?.started_at ?? now,
      completed_at: existing?.completed_at ?? now,
    };
  }

  if (status === "in_progress") {
    return {
      started_at: existing?.started_at ?? now,
      completed_at: null,
    };
  }

  return { started_at: null, completed_at: null };
}

function mapRoadmapItemToRow(
  item: RoadmapItem,
  clientId: string,
  shieldScoreId: string,
  existing?: RoadmapStatusRow,
) {
  const status = item.status;
  const timestamps = roadmapStatusTimestamps(status, existing);

  return {
    client_id: clientId,
    shield_score_id: shieldScoreId,
    item_key: item.id,
    is_active: true,
    score_version: SCORE_VERSION,
    title: item.title,
    pillar: item.pillar,
    current_score: item.currentScore,
    target_score: item.targetScore,
    estimated_impact: item.estimatedImpact,
    timeline_months: item.timelineMonths,
    difficulty: item.difficulty,
    priority: item.priority,
    status,
    gap_severity: item.gapSeverity ?? null,
    stress_exposure: item.stressExposure ?? null,
    impact_potential: item.impactPotential ?? null,
    urgency: item.urgency ?? null,
    started_at: timestamps.started_at,
    completed_at: timestamps.completed_at,
  };
}

async function loadActiveRoadmapStatuses(
  clientId: string,
): Promise<Map<string, RoadmapStatusRow>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("roadmap_items")
    .select("item_key, status, started_at, completed_at")
    .eq("client_id", clientId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to load roadmap statuses: ${error.message}`);
  }

  const map = new Map<string, RoadmapStatusRow>();
  for (const row of (data ?? []) as RoadmapStatusRow[]) {
    map.set(row.item_key, row);
  }
  return map;
}

function mergeRoadmapStatuses(
  dbStatuses: Map<string, RoadmapStatusRow>,
  localStatuses?: Record<string, RoadmapItemStatus>,
): Record<string, RoadmapItemStatus> {
  const merged: Record<string, RoadmapItemStatus> = {};

  for (const [key, row] of dbStatuses) {
    merged[key] = row.status;
  }

  if (localStatuses) {
    for (const [key, status] of Object.entries(localStatuses)) {
      merged[key] = status;
    }
  }

  return merged;
}

/**
 * Persists a completed Discover profile and full scoring snapshot chain for the
 * authenticated user's client. Uses the service-role client for all writes.
 */
export async function persistDiscoverProfile(
  client: AppClientRow,
  input: PersistDiscoverInput,
): Promise<PersistDiscoverResult> {
  const admin = createAdminSupabaseClient();
  const clientId = client.id;
  const stored = toStoredProfile(input);
  const completedAt = stored.completedAt;

  const financialProfile = buildClientFinancialProfile(stored);
  const dashboard = computeDashboardFromProfile(stored);

  const dbRoadmapStatuses = await loadActiveRoadmapStatuses(clientId);
  const mergedStatuses = mergeRoadmapStatuses(
    dbRoadmapStatuses,
    input.roadmapStatuses,
  );
  const roadmapResults = computeRoadmapFromProfile(stored, mergedStatuses);

  const { shield, awri, benchmark, stressTests, insights } = dashboard;
  const { roadmap, projected } = roadmapResults;
  const clientSummary = financialProfile.profile!;

  // 1. Demote prior discover_profiles
  const { error: demoteDiscoverError } = await admin
    .from("discover_profiles")
    .update({ is_current: false } as never)
    .eq("client_id", clientId)
    .eq("is_current", true);

  if (demoteDiscoverError) {
    throw new Error(
      `Failed to demote prior discover profiles: ${demoteDiscoverError.message}`,
    );
  }

  // 2. Insert discover_profiles
  const { data: discoverRow, error: discoverError } = await admin
    .from("discover_profiles")
    .insert({
      client_id: clientId,
      version: 1,
      is_current: true,
      completed_at: completedAt,
      form_data: stored.formData as never,
      completeness: stored.completeness as never,
      discover_score: stored.discoverScore,
      data_confidence_factor: stored.dataConfidenceFactor,
    } as never)
    .select("id")
    .single();

  if (discoverError || !discoverRow) {
    throw new Error(
      `Failed to insert discover profile: ${discoverError?.message ?? "unknown"}`,
    );
  }

  const discoverProfileId = (discoverRow as { id: string }).id;

  // 3. Demote prior financial_profiles
  const { error: demoteFinancialError } = await admin
    .from("financial_profiles")
    .update({ is_current: false } as never)
    .eq("client_id", clientId)
    .eq("is_current", true);

  if (demoteFinancialError) {
    throw new Error(
      `Failed to demote prior financial profiles: ${demoteFinancialError.message}`,
    );
  }

  // 4. Insert financial_profiles
  const { data: financialRow, error: financialError } = await admin
    .from("financial_profiles")
    .insert({
      client_id: clientId,
      discover_profile_id: discoverProfileId,
      is_current: true,
      profile_data: financialProfile as never,
      annual_income: clientSummary.income,
      net_worth: clientSummary.netWorth,
      total_debt: financialProfile.foundation.totalDebt,
      monthly_surplus: financialProfile.foundation.monthlySurplus,
      savings_rate: financialProfile.grow.savingsRate,
      is_business_owner: clientSummary.isBusinessOwner,
    } as never)
    .select("id")
    .single();

  if (financialError || !financialRow) {
    throw new Error(
      `Failed to insert financial profile: ${financialError?.message ?? "unknown"}`,
    );
  }

  const financialProfileId = (financialRow as { id: string }).id;

  // 5. Demote prior shield_scores
  const { error: demoteShieldError } = await admin
    .from("shield_scores")
    .update({ is_current: false } as never)
    .eq("client_id", clientId)
    .eq("is_current", true);

  if (demoteShieldError) {
    throw new Error(
      `Failed to demote prior shield scores: ${demoteShieldError.message}`,
    );
  }

  // 6. Insert shield_scores
  const { data: shieldRow, error: shieldError } = await admin
    .from("shield_scores")
    .insert({
      client_id: clientId,
      discover_profile_id: discoverProfileId,
      financial_profile_id: financialProfileId,
      is_current: true,
      score_version: SCORE_VERSION,
      snapshot_reason: "discover_save",
      raw_shield_score: shield.rawShieldScore,
      adjusted_shield_score: shield.adjustedShieldScore,
      data_confidence_factor: shield.dataConfidenceFactor,
      discover_score: shield.discoverScore,
      rating: shield.rating,
      awri: awri.awri,
      awri_rating: awri.rating,
      resilience_score: awri.resilienceScore,
      behaviour_score: awri.behaviourScore,
      governance_score: awri.governanceScore,
      continuity_score: awri.continuityScore,
      benchmark_cohort: benchmark.cohort,
      benchmark_cohort_average: benchmark.cohortAverage,
      benchmark_top_25: benchmark.top25,
      benchmark_top_10: benchmark.top10,
      benchmark_delta: benchmark.benchmarkDelta,
      benchmark_classification: benchmark.classification,
      weakest_pillar: insights.weakestPillar,
      strongest_pillar: insights.strongestPillar,
      projected_raw_shield_score: projected.projectedRawShieldScore,
      projected_adjusted_shield_score: projected.projectedAdjustedShieldScore,
      projected_rating: projected.projectedRating,
    } as never)
    .select("id")
    .single();

  if (shieldError || !shieldRow) {
    throw new Error(
      `Failed to insert shield score: ${shieldError?.message ?? "unknown"}`,
    );
  }

  const shieldScoreId = (shieldRow as { id: string }).id;

  // 7. Insert pillar_scores (7 rows)
  const pillarRows = (Object.keys(SHIELD_PILLAR_WEIGHTS) as ShieldPillar[]).map(
    (pillar) => {
      const score = shield.pillarScores[pillar];
      const weight = SHIELD_PILLAR_WEIGHTS[pillar];
      return {
        shield_score_id: shieldScoreId,
        client_id: clientId,
        pillar,
        score_version: SCORE_VERSION,
        score,
        weight,
        weighted_contribution: Math.round(score * weight * 1000) / 1000,
      };
    },
  );

  const { error: pillarError } = await admin
    .from("pillar_scores")
    .insert(pillarRows as never);

  if (pillarError) {
    throw new Error(`Failed to insert pillar scores: ${pillarError.message}`);
  }

  // 8. Insert stress_tests (10 rows)
  const stressRows = stressTests.map((test) => ({
    shield_score_id: shieldScoreId,
    client_id: clientId,
    scenario: test.scenario,
    severity: test.severity,
    score_version: SCORE_VERSION,
    pre_stress_score: test.preStressScore,
    post_stress_score: test.postStressScore,
    stress_penalty: test.stressPenalty,
    mitigation_credit: test.mitigationCredit,
    affected_pillars: test.affectedPillars as never,
  }));

  const { error: stressError } = await admin
    .from("stress_tests")
    .insert(stressRows as never);

  if (stressError) {
    throw new Error(`Failed to insert stress tests: ${stressError.message}`);
  }

  // 9. Deactivate prior active roadmap_items
  const { error: deactivateRoadmapError } = await admin
    .from("roadmap_items")
    .update({ is_active: false } as never)
    .eq("client_id", clientId)
    .eq("is_active", true);

  if (deactivateRoadmapError) {
    throw new Error(
      `Failed to deactivate prior roadmap items: ${deactivateRoadmapError.message}`,
    );
  }

  // 10. Insert new active roadmap_items (status preserved by item_key)
  if (roadmap.length > 0) {
    const roadmapRows = roadmap.map((item) =>
      mapRoadmapItemToRow(
        item,
        clientId,
        shieldScoreId,
        dbRoadmapStatuses.get(item.id),
      ),
    );

    const { error: roadmapError } = await admin
      .from("roadmap_items")
      .insert(roadmapRows as never);

    if (roadmapError) {
      throw new Error(`Failed to insert roadmap items: ${roadmapError.message}`);
    }
  }

  // 11. Update client_profiles current summary
  const { error: demoteClientProfileError } = await admin
    .from("client_profiles")
    .update({ is_current: false } as never)
    .eq("client_id", clientId)
    .eq("is_current", true);

  if (demoteClientProfileError) {
    throw new Error(
      `Failed to demote prior client profile: ${demoteClientProfileError.message}`,
    );
  }

  const { error: clientProfileError } = await admin
    .from("client_profiles")
    .insert({
      client_id: clientId,
      discover_profile_id: discoverProfileId,
      is_current: true,
      age: clientSummary.age,
      annual_income: clientSummary.income,
      net_worth: clientSummary.netWorth,
      marital_status: clientSummary.maritalStatus,
      has_children: clientSummary.hasChildren,
      has_partner: clientSummary.hasPartner,
      occupation: clientSummary.occupation ?? null,
      is_business_owner: clientSummary.isBusinessOwner,
      is_retired: clientSummary.isRetired,
      has_multiple_properties: clientSummary.hasMultipleProperties ?? false,
      has_cross_border_assets: clientSummary.hasCrossBorderAssets ?? false,
      has_trust_structure: clientSummary.hasTrustStructure ?? false,
      has_multi_generation_dependants:
        clientSummary.hasMultiGenerationDependants ?? false,
      has_philanthropic_goals: clientSummary.hasPhilanthropicGoals ?? false,
      current_adjusted_shield_score: shield.adjustedShieldScore,
      current_shield_rating: shield.rating,
      weakest_pillar: insights.weakestPillar,
      strongest_pillar: insights.strongestPillar,
    } as never);

  if (clientProfileError) {
    throw new Error(
      `Failed to insert client profile summary: ${clientProfileError.message}`,
    );
  }

  const discoverDateOfBirth = parseDateOfBirth(stored.formData.personal.dateOfBirth);
  if (discoverDateOfBirth) {
    await syncClientDateOfBirthFromDiscover(clientId, discoverDateOfBirth);
  }

  // Phase 9B: relationship stage advances only via explicit prospect submission.
  // Do not promote legacy status to active on profile save.

  return {
    discoverProfileId,
    financialProfileId,
    shieldScoreId,
    clientId,
    adjustedShieldScore: shield.adjustedShieldScore,
    rating: shield.rating,
  };
}

/**
 * Loads the current discover profile for a client, if one exists.
 */
export async function loadCurrentDiscoverProfile(
  clientId: string,
): Promise<CurrentDiscoverProfile | null> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("discover_profiles")
    .select(
      "id, client_id, version, completed_at, form_data, completeness, discover_score, data_confidence_factor",
    )
    .eq("client_id", clientId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load discover profile: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as {
    id: string;
    client_id: string;
    version: number;
    completed_at: string;
    form_data: DiscoverStoredProfile["formData"];
    completeness: DiscoverStoredProfile["completeness"];
    discover_score: number;
    data_confidence_factor: number;
  };

  if (row.version !== 1) {
    return null;
  }

  return {
    id: row.id,
    clientId: row.client_id,
    version: 1,
    completedAt: row.completed_at,
    formData: row.form_data,
    completeness: row.completeness,
    discoverScore: Number(row.discover_score),
    dataConfidenceFactor: Number(row.data_confidence_factor),
  };
}
