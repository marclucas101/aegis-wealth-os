import "server-only";

import type {
  AWRIResult,
  ClientProfile,
  PillarScores,
  ProjectedShieldResult,
  RoadmapItem,
  ShieldPillar,
  ShieldRating,
  ShieldScoreResult,
  StressTestResult,
} from "@/src/lib/scoring/types";
import { calculateProjectedShield, sortRoadmapByPriority } from "@/src/lib/scoring";
import type { DiscoverFormData } from "@/lib/aegis/localProfile";

import { createAdminSupabaseClient } from "./admin";
import { loadCurrentDiscoverProfile } from "./discoverPersistence";
import type { AppClientRow } from "./userProfile";

export type ModuleSource = "supabase";

const PILLAR_LABELS: Record<ShieldPillar, string> = {
  foundation: "Foundation",
  protect: "Protect",
  grow: "Grow",
  optimise: "Optimise",
  transition: "Transition",
  preserve: "Preserve",
  legacy: "Legacy",
};

export type WeakestPillarEntry = {
  pillar: ShieldPillar;
  label: string;
  score: number;
};

export type AnnualReviewTimelineYear = {
  calendarYear: number;
  yearOffset: number;
  label: string;
  adjustedShieldScore: number;
  rating: ShieldRating;
  progressPercent: number;
  actionsCompleted: number;
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
  weakest_pillar: ShieldPillar | null;
  strongest_pillar: ShieldPillar | null;
  projected_raw_shield_score: number | string | null;
  projected_adjusted_shield_score: number | string | null;
  projected_rating: ShieldRating | null;
};

type PillarScoreRow = {
  pillar: ShieldPillar;
  score: number | string;
  shield_score_id: string;
};

type StressTestRow = {
  scenario: StressTestResult["scenario"];
  severity: StressTestResult["severity"];
  pre_stress_score: number | string;
  post_stress_score: number | string;
  stress_penalty: number | string;
  mitigation_credit: number | string;
  affected_pillars: Partial<PillarScores>;
  shield_score_id: string;
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

export type ModuleBaseSnapshot = {
  source: ModuleSource;
  clientId: string;
  completedAt: string;
  discoverScore: number;
  dataConfidenceFactor: number;
  formData: DiscoverFormData;
  client: ClientProfile;
  shield: ShieldScoreResult;
  awri: AWRIResult;
  pillarScores: PillarScores;
  stressTests: StressTestResult[];
  topStressExposures: StressTestResult[];
  roadmap: RoadmapItem[];
  projected: ProjectedShieldResult | null;
  weakestPillar: ShieldPillar;
  strongestPillar: ShieldPillar;
  weakestPillars: WeakestPillarEntry[];
};

export type ShieldDiagnosticSnapshot = Pick<
  ModuleBaseSnapshot,
  | "source"
  | "clientId"
  | "completedAt"
  | "client"
  | "formData"
  | "shield"
  | "weakestPillars"
>;

export type RoadmapSnapshot = Pick<
  ModuleBaseSnapshot,
  | "source"
  | "clientId"
  | "completedAt"
  | "client"
  | "shield"
  | "roadmap"
  | "projected"
> & {
  projected: ProjectedShieldResult;
};

export type StressTestingSnapshot = Pick<
  ModuleBaseSnapshot,
  | "source"
  | "clientId"
  | "completedAt"
  | "client"
  | "shield"
  | "stressTests"
  | "topStressExposures"
>;

export type WealthBlueprintSnapshot = Pick<
  ModuleBaseSnapshot,
  | "source"
  | "clientId"
  | "completedAt"
  | "client"
  | "formData"
  | "shield"
  | "awri"
  | "stressTests"
  | "topStressExposures"
  | "roadmap"
  | "weakestPillars"
> & {
  projected: ProjectedShieldResult;
};

export type AnnualReviewSnapshot = Pick<
  ModuleBaseSnapshot,
  | "source"
  | "clientId"
  | "completedAt"
  | "client"
  | "formData"
  | "shield"
  | "awri"
  | "roadmap"
  | "topStressExposures"
  | "weakestPillars"
  | "discoverScore"
  | "dataConfidenceFactor"
> & {
  projected: ProjectedShieldResult;
  timeline: AnnualReviewTimelineYear[];
  totalImprovement: number;
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

function getWeakestPillarsFromScores(
  scores: PillarScores,
  count = 3,
): WeakestPillarEntry[] {
  return (Object.entries(scores) as Array<[ShieldPillar, number]>)
    .sort(([, a], [, b]) => a - b)
    .slice(0, count)
    .map(([pillar, score]) => ({
      pillar,
      label: PILLAR_LABELS[pillar],
      score,
    }));
}

function roadmapAtYearOffset(
  items: RoadmapItem[],
  yearOffset: number,
): RoadmapItem[] {
  if (yearOffset === 0) {
    return items;
  }

  const monthsCutoff = yearOffset * 12;
  const includeAll = yearOffset >= 3;

  return items.map((item) => {
    if (item.status === "completed") {
      return item;
    }
    if (includeAll || item.timelineMonths <= monthsCutoff) {
      return { ...item, status: "completed" as const };
    }
    return item;
  });
}

function buildAnnualReviewTimeline(
  currentScore: number,
  shield: ShieldScoreResult,
  roadmap: RoadmapItem[],
): AnnualReviewTimelineYear[] {
  const currentYear = new Date().getFullYear();
  const targetRoadmap = roadmapAtYearOffset(roadmap, 3);
  const targetProjected = calculateProjectedShield(
    shield.pillarScores,
    targetRoadmap,
    shield.dataConfidenceFactor,
  );
  const targetScore = targetProjected.projectedAdjustedShieldScore;
  const scoreRange = targetScore - currentScore;
  const labels = ["Current Year", "Year +1", "Year +2", "Year +3 Target"];

  return [0, 1, 2, 3].map((yearOffset) => {
    let score: number;
    let rating: ShieldRating;
    let actionsCompleted: number;

    if (yearOffset === 0) {
      score = currentScore;
      rating = shield.rating;
      actionsCompleted = roadmap.filter((item) => item.status === "completed").length;
    } else {
      const yearRoadmap = roadmapAtYearOffset(roadmap, yearOffset);
      const projected = calculateProjectedShield(
        shield.pillarScores,
        yearRoadmap,
        shield.dataConfidenceFactor,
      );
      score = projected.projectedAdjustedShieldScore;
      rating = projected.projectedRating;
      actionsCompleted = yearRoadmap.filter(
        (item) => item.status === "completed",
      ).length;
    }

    const progressPercent =
      scoreRange > 0
        ? Math.round(((score - currentScore) / scoreRange) * 100)
        : 100;

    return {
      calendarYear: currentYear + yearOffset,
      yearOffset,
      label: labels[yearOffset],
      adjustedShieldScore: score,
      rating,
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
      actionsCompleted,
    };
  });
}

/**
 * Loads the shared Supabase snapshot chain for module pages.
 * Returns null when no current Discover profile or shield score exists.
 */
export async function loadModuleBaseSnapshot(
  client: AppClientRow,
): Promise<ModuleBaseSnapshot | null> {
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
  const pillarRows = (pillarResult.data ?? []).filter(
    (row) => (row as PillarScoreRow).shield_score_id === shieldScoreId,
  ) as PillarScoreRow[];
  const stressRows = (stressResult.data ?? []).filter(
    (row) => (row as StressTestRow).shield_score_id === shieldScoreId,
  ) as StressTestRow[];

  const pillarScores = mapPillarScores(pillarRows);
  const shield = mapShieldScore(shieldRow, pillarScores);
  const stressTests = stressRows.map(mapStressTest);
  const roadmap = sortRoadmapByPriority(
    ((roadmapResult.data ?? []) as RoadmapItemRow[]).map(mapRoadmapItem),
  );
  const projected = mapProjected(shieldRow, pillarScores);

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
    discoverScore: discover.discoverScore,
    dataConfidenceFactor: discover.dataConfidenceFactor,
    formData: discover.formData,
    client: clientSummary,
    shield,
    awri: mapAwri(shieldRow),
    pillarScores,
    stressTests,
    topStressExposures: topStressExposures(stressTests),
    roadmap,
    projected,
    weakestPillar,
    strongestPillar,
    weakestPillars: getWeakestPillarsFromScores(pillarScores, 3),
  };
}

export async function loadShieldDiagnosticSnapshot(
  client: AppClientRow,
): Promise<ShieldDiagnosticSnapshot | null> {
  const base = await loadModuleBaseSnapshot(client);
  if (!base) return null;

  return {
    source: base.source,
    clientId: base.clientId,
    completedAt: base.completedAt,
    client: base.client,
    formData: base.formData,
    shield: base.shield,
    weakestPillars: base.weakestPillars,
  };
}

export async function loadRoadmapSnapshot(
  client: AppClientRow,
): Promise<RoadmapSnapshot | null> {
  const base = await loadModuleBaseSnapshot(client);
  if (!base || !base.projected) return null;

  return {
    source: base.source,
    clientId: base.clientId,
    completedAt: base.completedAt,
    client: base.client,
    shield: base.shield,
    roadmap: base.roadmap,
    projected: base.projected,
  };
}

export async function loadStressTestingSnapshot(
  client: AppClientRow,
): Promise<StressTestingSnapshot | null> {
  const base = await loadModuleBaseSnapshot(client);
  if (!base) return null;

  return {
    source: base.source,
    clientId: base.clientId,
    completedAt: base.completedAt,
    client: base.client,
    shield: base.shield,
    stressTests: base.stressTests,
    topStressExposures: base.topStressExposures,
  };
}

export async function loadWealthBlueprintSnapshot(
  client: AppClientRow,
): Promise<WealthBlueprintSnapshot | null> {
  const base = await loadModuleBaseSnapshot(client);
  if (!base || !base.projected) return null;

  return {
    source: base.source,
    clientId: base.clientId,
    completedAt: base.completedAt,
    client: base.client,
    formData: base.formData,
    shield: base.shield,
    awri: base.awri,
    stressTests: base.stressTests,
    topStressExposures: base.topStressExposures,
    roadmap: base.roadmap,
    projected: base.projected,
    weakestPillars: base.weakestPillars,
  };
}

export async function loadAnnualReviewSnapshot(
  client: AppClientRow,
): Promise<AnnualReviewSnapshot | null> {
  const base = await loadModuleBaseSnapshot(client);
  if (!base || !base.projected) return null;

  const targetProjected = calculateProjectedShield(
    base.shield.pillarScores,
    base.roadmap.map((item) => ({ ...item, status: "completed" as const })),
    base.shield.dataConfidenceFactor,
  );

  const timeline = buildAnnualReviewTimeline(
    base.shield.adjustedShieldScore,
    base.shield,
    base.roadmap,
  );

  return {
    source: base.source,
    clientId: base.clientId,
    completedAt: base.completedAt,
    client: base.client,
    formData: base.formData,
    shield: base.shield,
    awri: base.awri,
    roadmap: base.roadmap,
    topStressExposures: base.topStressExposures,
    weakestPillars: base.weakestPillars,
    discoverScore: base.discoverScore,
    dataConfidenceFactor: base.dataConfidenceFactor,
    projected: targetProjected,
    timeline,
    totalImprovement:
      targetProjected.projectedAdjustedShieldScore -
      base.shield.adjustedShieldScore,
  };
}
