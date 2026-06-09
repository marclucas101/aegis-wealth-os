import "server-only";

import type {
  AWRIResult,
  BenchmarkClassification,
  BenchmarkCohort,
  BenchmarkResult,
  ClientProfile,
  PillarScores,
  ProjectedShieldResult,
  RoadmapItem,
  ShieldPillar,
  ShieldRating,
  ShieldScoreResult,
  StressTestResult,
} from "@/src/lib/scoring/types";
import { sortRoadmapByPriority } from "@/src/lib/scoring";

import { createAdminSupabaseClient } from "./admin";
import { loadCurrentDiscoverProfile } from "./discoverPersistence";
import type { AppClientRow } from "./userProfile";

export type DashboardSnapshot = {
  source: "supabase";
  clientId: string;
  completedAt: string;
  client: ClientProfile;
  discoverScore: number;
  dataConfidenceFactor: number;
  shield: ShieldScoreResult;
  awri: AWRIResult;
  benchmark: BenchmarkResult;
  stressTests: StressTestResult[];
  topStressExposures: StressTestResult[];
  roadmap: RoadmapItem[];
  topPriorityGaps: RoadmapItem[];
  insights: {
    weakestPillar: ShieldPillar;
    strongestPillar: ShieldPillar;
  };
  projected: ProjectedShieldResult | null;
};

type ClientProfileRow = {
  age: number;
  annual_income: number | string;
  net_worth: number | string;
  marital_status: ClientProfile["maritalStatus"];
  has_children: boolean;
  has_partner: boolean;
  occupation: string | null;
  is_business_owner: boolean;
  is_retired: boolean;
  has_multiple_properties: boolean;
  has_cross_border_assets: boolean;
  has_trust_structure: boolean;
  has_multi_generation_dependants: boolean;
  has_philanthropic_goals: boolean;
  weakest_pillar: ShieldPillar | null;
  strongest_pillar: ShieldPillar | null;
};

type ShieldScoreRow = {
  id: string;
  raw_shield_score: number | string;
  adjusted_shield_score: number | string;
  data_confidence_factor: number | string;
  discover_score: number | string;
  rating: ShieldRating;
  awri: number | string | null;
  awri_rating: ShieldRating | null;
  resilience_score: number | string | null;
  behaviour_score: number | string | null;
  governance_score: number | string | null;
  continuity_score: number | string | null;
  benchmark_cohort: string | null;
  benchmark_cohort_average: number | string | null;
  benchmark_top_25: number | string | null;
  benchmark_top_10: number | string | null;
  benchmark_delta: number | string | null;
  benchmark_classification: BenchmarkClassification | null;
  weakest_pillar: ShieldPillar | null;
  strongest_pillar: ShieldPillar | null;
  projected_raw_shield_score: number | string | null;
  projected_adjusted_shield_score: number | string | null;
  projected_rating: ShieldRating | null;
};

type PillarScoreRow = {
  pillar: ShieldPillar;
  score: number | string;
};

type StressTestRow = {
  scenario: StressTestResult["scenario"];
  severity: StressTestResult["severity"];
  pre_stress_score: number | string;
  post_stress_score: number | string;
  stress_penalty: number | string;
  mitigation_credit: number | string;
  affected_pillars: Partial<PillarScores>;
};

type RoadmapItemRow = {
  item_key: string;
  title: string;
  pillar: ShieldPillar;
  current_score: number | string;
  target_score: number | string;
  estimated_impact: number | string;
  timeline_months: number;
  difficulty: RoadmapItem["difficulty"];
  priority: RoadmapItem["priority"];
  status: RoadmapItem["status"];
  gap_severity: number | string | null;
  stress_exposure: number | string | null;
  impact_potential: number | string | null;
  urgency: number | string | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function mapClientProfile(row: ClientProfileRow): ClientProfile {
  return {
    age: row.age,
    income: toNumber(row.annual_income),
    netWorth: toNumber(row.net_worth),
    maritalStatus: row.marital_status,
    hasChildren: row.has_children,
    hasPartner: row.has_partner,
    occupation: row.occupation ?? undefined,
    isBusinessOwner: row.is_business_owner,
    isRetired: row.is_retired,
    hasMultipleProperties: row.has_multiple_properties,
    hasCrossBorderAssets: row.has_cross_border_assets,
    hasTrustStructure: row.has_trust_structure,
    hasMultiGenerationDependants: row.has_multi_generation_dependants,
    hasPhilanthropicGoals: row.has_philanthropic_goals,
  };
}

function mapPillarScores(rows: PillarScoreRow[]): PillarScores {
  const scores: Partial<PillarScores> = {};
  for (const row of rows) {
    scores[row.pillar] = toNumber(row.score);
  }

  return scores as PillarScores;
}

function mapShieldScore(
  row: ShieldScoreRow,
  pillarScores: PillarScores,
): ShieldScoreResult {
  return {
    rawShieldScore: toNumber(row.raw_shield_score),
    adjustedShieldScore: toNumber(row.adjusted_shield_score),
    dataConfidenceFactor: toNumber(row.data_confidence_factor),
    discoverScore: toNumber(row.discover_score),
    rating: row.rating,
    pillarScores,
  };
}

function mapAwri(row: ShieldScoreRow): AWRIResult {
  return {
    awri: toNumber(row.awri),
    rating: row.awri_rating ?? row.rating,
    adjustedShieldScore: toNumber(row.adjusted_shield_score),
    resilienceScore: toNumber(row.resilience_score),
    behaviourScore: toNumber(row.behaviour_score),
    governanceScore: toNumber(row.governance_score),
    continuityScore: toNumber(row.continuity_score),
  };
}

function mapBenchmark(row: ShieldScoreRow): BenchmarkResult {
  return {
    cohort: (row.benchmark_cohort ?? "Young Professional") as BenchmarkCohort,
    clientScore: toNumber(row.adjusted_shield_score),
    cohortAverage: toNumber(row.benchmark_cohort_average),
    top25: toNumber(row.benchmark_top_25),
    top10: toNumber(row.benchmark_top_10),
    benchmarkDelta: toNumber(row.benchmark_delta),
    classification:
      row.benchmark_classification ?? ("In Line" as BenchmarkClassification),
  };
}

function mapStressTest(row: StressTestRow): StressTestResult {
  return {
    scenario: row.scenario,
    severity: row.severity,
    preStressScore: toNumber(row.pre_stress_score),
    postStressScore: toNumber(row.post_stress_score),
    stressPenalty: toNumber(row.stress_penalty),
    mitigationCredit: toNumber(row.mitigation_credit),
    affectedPillars: row.affected_pillars ?? {},
  };
}

function mapRoadmapItem(row: RoadmapItemRow): RoadmapItem {
  return {
    id: row.item_key,
    title: row.title,
    pillar: row.pillar,
    currentScore: toNumber(row.current_score),
    targetScore: toNumber(row.target_score),
    estimatedImpact: toNumber(row.estimated_impact),
    timelineMonths: row.timeline_months,
    difficulty: row.difficulty,
    priority: row.priority,
    status: row.status,
    gapSeverity: row.gap_severity != null ? toNumber(row.gap_severity) : undefined,
    stressExposure:
      row.stress_exposure != null ? toNumber(row.stress_exposure) : undefined,
    impactPotential:
      row.impact_potential != null ? toNumber(row.impact_potential) : undefined,
    urgency: row.urgency != null ? toNumber(row.urgency) : undefined,
  };
}

function mapProjected(
  row: ShieldScoreRow,
  pillarScores: PillarScores,
): ProjectedShieldResult | null {
  if (row.projected_adjusted_shield_score == null) {
    return null;
  }

  return {
    projectedPillarScores: pillarScores,
    projectedRawShieldScore: toNumber(row.projected_raw_shield_score),
    projectedAdjustedShieldScore: toNumber(row.projected_adjusted_shield_score),
    projectedRating: row.projected_rating ?? row.rating,
  };
}

function topStressExposures(tests: StressTestResult[]): StressTestResult[] {
  return [...tests]
    .sort((a, b) => a.postStressScore - b.postStressScore)
    .slice(0, 3);
}

/**
 * Loads the current dashboard snapshot for an authenticated client from Supabase.
 * Returns null when no current Discover profile exists.
 */
export async function loadDashboardSnapshot(
  client: AppClientRow,
): Promise<DashboardSnapshot | null> {
  const discover = await loadCurrentDiscoverProfile(client.id);
  if (!discover) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const clientId = client.id;

  const [
    clientProfileResult,
    shieldResult,
    pillarResult,
    stressResult,
    roadmapResult,
  ] = await Promise.all([
    admin
      .from("client_profiles")
      .select(
        "age, annual_income, net_worth, marital_status, has_children, has_partner, occupation, is_business_owner, is_retired, has_multiple_properties, has_cross_border_assets, has_trust_structure, has_multi_generation_dependants, has_philanthropic_goals, weakest_pillar, strongest_pillar",
      )
      .eq("client_id", clientId)
      .eq("is_current", true)
      .maybeSingle(),
    admin
      .from("shield_scores")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_current", true)
      .maybeSingle(),
    admin
      .from("pillar_scores")
      .select("pillar, score, shield_score_id")
      .eq("client_id", clientId),
    admin
      .from("stress_tests")
      .select(
        "scenario, severity, pre_stress_score, post_stress_score, stress_penalty, mitigation_credit, affected_pillars, shield_score_id",
      )
      .eq("client_id", clientId),
    admin
      .from("roadmap_items")
      .select(
        "item_key, title, pillar, current_score, target_score, estimated_impact, timeline_months, difficulty, priority, status, gap_severity, stress_exposure, impact_potential, urgency",
      )
      .eq("client_id", clientId)
      .eq("is_active", true),
  ]);

  if (clientProfileResult.error) {
    throw new Error(
      `Failed to load client profile: ${clientProfileResult.error.message}`,
    );
  }
  if (shieldResult.error) {
    throw new Error(`Failed to load shield score: ${shieldResult.error.message}`);
  }
  if (pillarResult.error) {
    throw new Error(`Failed to load pillar scores: ${pillarResult.error.message}`);
  }
  if (stressResult.error) {
    throw new Error(`Failed to load stress tests: ${stressResult.error.message}`);
  }
  if (roadmapResult.error) {
    throw new Error(`Failed to load roadmap items: ${roadmapResult.error.message}`);
  }

  const shieldRow = shieldResult.data as ShieldScoreRow | null;
  if (!shieldRow) {
    return null;
  }

  const shieldScoreId = shieldRow.id;

  const pillarRows = ((pillarResult.data ?? []) as (PillarScoreRow & {
    shield_score_id: string;
  })[]).filter((row) => row.shield_score_id === shieldScoreId);

  const stressRows = ((stressResult.data ?? []) as (StressTestRow & {
    shield_score_id: string;
  })[]).filter((row) => row.shield_score_id === shieldScoreId);

  const pillarScores = mapPillarScores(pillarRows);
  const shield = mapShieldScore(shieldRow, pillarScores);
  const stressTests = stressRows.map(mapStressTest);
  const roadmap = sortRoadmapByPriority(
    ((roadmapResult.data ?? []) as RoadmapItemRow[]).map(mapRoadmapItem),
  );

  const clientProfileRow = clientProfileResult.data as ClientProfileRow | null;
  const clientSummary = clientProfileRow
    ? mapClientProfile(clientProfileRow)
    : mapClientProfile({
        age: 0,
        annual_income: 0,
        net_worth: 0,
        marital_status: "single",
        has_children: false,
        has_partner: false,
        occupation: null,
        is_business_owner: false,
        is_retired: false,
        has_multiple_properties: false,
        has_cross_border_assets: false,
        has_trust_structure: false,
        has_multi_generation_dependants: false,
        has_philanthropic_goals: false,
        weakest_pillar: shieldRow.weakest_pillar,
        strongest_pillar: shieldRow.strongest_pillar,
      });

  const weakestPillar =
    clientProfileRow?.weakest_pillar ??
    shieldRow.weakest_pillar ??
    ("foundation" as ShieldPillar);
  const strongestPillar =
    clientProfileRow?.strongest_pillar ??
    shieldRow.strongest_pillar ??
    ("foundation" as ShieldPillar);

  return {
    source: "supabase",
    clientId,
    completedAt: discover.completedAt,
    client: clientSummary,
    discoverScore: discover.discoverScore,
    dataConfidenceFactor: discover.dataConfidenceFactor,
    shield,
    awri: mapAwri(shieldRow),
    benchmark: mapBenchmark(shieldRow),
    stressTests,
    topStressExposures: topStressExposures(stressTests),
    roadmap,
    topPriorityGaps: roadmap.slice(0, 3),
    insights: {
      weakestPillar,
      strongestPillar,
    },
    projected: mapProjected(shieldRow, pillarScores),
  };
}
