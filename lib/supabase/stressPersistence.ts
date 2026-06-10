import "server-only";

import {
  buildClientFinancialProfile,
  refreshDiscoverScores,
  type DiscoverFormData,
} from "@/lib/aegis/localProfile";
import { SHIELD_PILLAR_WEIGHTS } from "@/src/lib/scoring/constants";
import { runStressTest } from "@/src/lib/scoring";
import type {
  ClientFinancialProfile,
  MitigationInputs,
  PillarScores,
  ShieldPillar,
  ShieldRating,
  StressScenario,
  StressSeverity,
  StressTestResult,
} from "@/src/lib/scoring/types";

import { createAdminSupabaseClient } from "./admin";
import { loadCurrentDiscoverProfile } from "./discoverPersistence";
import type { AppClientRow } from "./userProfile";

const SCORE_VERSION = "v1";
const DEFAULT_HISTORY_LIMIT = 30;

export const STRESS_SCENARIO_KEYS = [
  "income_loss",
  "critical_illness",
  "death_event",
  "disability",
  "market_crash",
  "inflation_shock",
  "longevity",
  "business_failure",
  "parent_care",
  "estate_delay",
] as const satisfies readonly StressScenario[];

export const INTERACTIVE_STRESS_SEVERITIES = [
  "mild",
  "moderate",
  "severe",
] as const;

export type InteractiveStressSeverity =
  (typeof INTERACTIVE_STRESS_SEVERITIES)[number];

type ShieldScoreContextRow = {
  id: string;
  client_id: string;
  discover_profile_id: string;
  financial_profile_id: string;
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
  benchmark_classification: string | null;
  weakest_pillar: ShieldPillar | null;
  strongest_pillar: ShieldPillar | null;
  projected_raw_shield_score: number | string | null;
  projected_adjusted_shield_score: number | string | null;
  projected_rating: ShieldRating | null;
};

type PillarScoreContextRow = {
  pillar: ShieldPillar;
  score: number | string;
  weight: number | string;
  weighted_contribution: number | string;
};

type StressTestInsertRow = {
  id: string;
  shield_score_id: string;
  client_id: string;
  scenario: StressScenario;
  severity: StressSeverity;
  pre_stress_score: number | string;
  post_stress_score: number | string;
  stress_penalty: number | string;
  mitigation_credit: number | string;
  affected_pillars: Partial<PillarScores>;
  created_at: string;
};

export type PersistStressTestRunResult = {
  id: string;
  shield_score_id: string;
  created_at: string;
  result: StressTestResult;
  score_drop: number;
  mitigation_notes: string;
};

export type StressTestHistoryEntry = {
  id: string;
  client_id: string;
  shield_score_id: string;
  scenario: StressScenario;
  severity: StressSeverity;
  pre_stress_score: number;
  post_stress_score: number;
  score_drop: number;
  affected_pillars: Partial<PillarScores>;
  mitigation_notes: string;
  created_at: string;
};

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function parseNum(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function deriveMitigationInputs(
  financial: ClientFinancialProfile,
  formData: DiscoverFormData,
): MitigationInputs {
  const monthlyEssential = financial.foundation.monthlyEssentialExpenses;
  const emergencyFundMonths =
    monthlyEssential > 0
      ? financial.foundation.liquidEmergencyAssets / monthlyEssential
      : 0;
  const annualIncome = financial.protect.annualIncome;
  const ciCoverageMultipleOfIncome =
    annualIncome > 0 ? financial.protect.existingCICoverage / annualIncome : 0;

  const allocation = formData.investments.assetAllocation;
  const hasDiversifiedPortfolio =
    allocation === "balanced" ||
    allocation === "growth" ||
    allocation === "strategic";

  return {
    emergencyFundMonths,
    ciCoverageMultipleOfIncome,
    hasDisabilityIncomeCoverage:
      parseNum(formData.policies.disabilityCoverage) > 0,
    hasValidWill: formData.estate.hasWill,
    hasDiversifiedPortfolio,
    hasHealthcareFundingReserve:
      financial.preserve.healthcareFunding === "good_hospitalisation" ||
      financial.preserve.healthcareFunding === "reserve_included",
    hasBusinessSuccessionPlan:
      formData.business.isBusinessOwner &&
      (formData.business.successionPlan === "formal" ||
        formData.business.successionPlan === "key_person"),
    hasEstateLiquidityPlan:
      formData.estate.estatePlanReviewed && formData.estate.hasWill,
  };
}

export function isValidStressScenario(
  value: string,
): value is StressScenario {
  return (STRESS_SCENARIO_KEYS as readonly string[]).includes(value);
}

export function isValidInteractiveSeverity(
  value: string,
): value is InteractiveStressSeverity {
  return (INTERACTIVE_STRESS_SEVERITIES as readonly string[]).includes(value);
}

function buildMitigationNotes(credit: number): string {
  if (credit <= 0) {
    return "No mitigation safeguards were credited against this scenario.";
  }

  return `Existing mitigation safeguards offset ${credit.toFixed(1)} points of the gross stress penalty.`;
}

function mapPillarScores(rows: PillarScoreContextRow[]): PillarScores {
  const scores: Partial<PillarScores> = {};
  for (const row of rows) {
    scores[row.pillar] = toNumber(row.score);
  }
  return scores as PillarScores;
}

async function loadCurrentShieldContext(clientId: string): Promise<{
  shieldRow: ShieldScoreContextRow;
  pillarRows: PillarScoreContextRow[];
  pillarScores: PillarScores;
  mitigation: MitigationInputs;
} | null> {
  const admin = createAdminSupabaseClient();

  const [shieldResult, pillarResult, discover] = await Promise.all([
    admin
      .from("shield_scores")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_current", true)
      .maybeSingle(),
    admin
      .from("pillar_scores")
      .select("pillar, score, weight, weighted_contribution, shield_score_id")
      .eq("client_id", clientId),
    loadCurrentDiscoverProfile(clientId),
  ]);

  if (shieldResult.error) {
    throw new Error(
      `Failed to load current shield score: ${shieldResult.error.message}`,
    );
  }
  if (pillarResult.error) {
    throw new Error(
      `Failed to load pillar scores: ${pillarResult.error.message}`,
    );
  }
  if (!shieldResult.data || !discover) {
    return null;
  }

  const shieldRow = shieldResult.data as ShieldScoreContextRow;
  const pillarRows = ((pillarResult.data ?? []) as Array<
    PillarScoreContextRow & { shield_score_id: string }
  >).filter((row) => row.shield_score_id === shieldRow.id);

  const stored = refreshDiscoverScores(discover);
  const financialProfile = buildClientFinancialProfile(stored);
  const mitigation = deriveMitigationInputs(
    financialProfile,
    stored.formData,
  );

  return {
    shieldRow,
    pillarRows,
    pillarScores: mapPillarScores(pillarRows),
    mitigation,
  };
}

async function cloneHistoricalShieldSnapshot(
  shieldRow: ShieldScoreContextRow,
  pillarRows: PillarScoreContextRow[],
): Promise<string> {
  const admin = createAdminSupabaseClient();

  const { data: insertedShield, error: shieldError } = await admin
    .from("shield_scores")
    .insert({
      client_id: shieldRow.client_id,
      discover_profile_id: shieldRow.discover_profile_id,
      financial_profile_id: shieldRow.financial_profile_id,
      is_current: false,
      score_version: SCORE_VERSION,
      snapshot_reason: "stress_test_run",
      raw_shield_score: toNumber(shieldRow.raw_shield_score),
      adjusted_shield_score: toNumber(shieldRow.adjusted_shield_score),
      data_confidence_factor: toNumber(shieldRow.data_confidence_factor),
      discover_score: toNumber(shieldRow.discover_score),
      rating: shieldRow.rating,
      awri: shieldRow.awri != null ? toNumber(shieldRow.awri) : null,
      awri_rating: shieldRow.awri_rating,
      resilience_score:
        shieldRow.resilience_score != null
          ? toNumber(shieldRow.resilience_score)
          : null,
      behaviour_score:
        shieldRow.behaviour_score != null
          ? toNumber(shieldRow.behaviour_score)
          : null,
      governance_score:
        shieldRow.governance_score != null
          ? toNumber(shieldRow.governance_score)
          : null,
      continuity_score:
        shieldRow.continuity_score != null
          ? toNumber(shieldRow.continuity_score)
          : null,
      benchmark_cohort: shieldRow.benchmark_cohort,
      benchmark_cohort_average:
        shieldRow.benchmark_cohort_average != null
          ? toNumber(shieldRow.benchmark_cohort_average)
          : null,
      benchmark_top_25:
        shieldRow.benchmark_top_25 != null
          ? toNumber(shieldRow.benchmark_top_25)
          : null,
      benchmark_top_10:
        shieldRow.benchmark_top_10 != null
          ? toNumber(shieldRow.benchmark_top_10)
          : null,
      benchmark_delta:
        shieldRow.benchmark_delta != null
          ? toNumber(shieldRow.benchmark_delta)
          : null,
      benchmark_classification: shieldRow.benchmark_classification,
      weakest_pillar: shieldRow.weakest_pillar,
      strongest_pillar: shieldRow.strongest_pillar,
      projected_raw_shield_score:
        shieldRow.projected_raw_shield_score != null
          ? toNumber(shieldRow.projected_raw_shield_score)
          : null,
      projected_adjusted_shield_score:
        shieldRow.projected_adjusted_shield_score != null
          ? toNumber(shieldRow.projected_adjusted_shield_score)
          : null,
      projected_rating: shieldRow.projected_rating,
    } as never)
    .select("id")
    .single();

  if (shieldError || !insertedShield) {
    throw new Error(
      `Failed to create historical shield snapshot: ${shieldError?.message ?? "unknown"}`,
    );
  }

  const historicalShieldId = (insertedShield as { id: string }).id;

  if (pillarRows.length > 0) {
    const pillarInsertRows = pillarRows.map((row) => ({
      shield_score_id: historicalShieldId,
      client_id: shieldRow.client_id,
      pillar: row.pillar,
      score_version: SCORE_VERSION,
      score: toNumber(row.score),
      weight:
        toNumber(row.weight) || SHIELD_PILLAR_WEIGHTS[row.pillar as ShieldPillar],
      weighted_contribution: toNumber(row.weighted_contribution),
    }));

    const { error: pillarError } = await admin
      .from("pillar_scores")
      .insert(pillarInsertRows as never);

    if (pillarError) {
      throw new Error(
        `Failed to clone pillar scores for stress run: ${pillarError.message}`,
      );
    }
  }

  return historicalShieldId;
}

async function insertStressTestRow(params: {
  shieldScoreId: string;
  clientId: string;
  result: StressTestResult;
}): Promise<StressTestInsertRow> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("stress_tests")
    .insert({
      shield_score_id: params.shieldScoreId,
      client_id: params.clientId,
      scenario: params.result.scenario,
      severity: params.result.severity,
      score_version: SCORE_VERSION,
      pre_stress_score: params.result.preStressScore,
      post_stress_score: params.result.postStressScore,
      stress_penalty: params.result.stressPenalty,
      mitigation_credit: params.result.mitigationCredit,
      affected_pillars: params.result.affectedPillars as never,
    } as never)
    .select(
      "id, shield_score_id, client_id, scenario, severity, pre_stress_score, post_stress_score, stress_penalty, mitigation_credit, affected_pillars, created_at",
    )
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to insert stress test row");
  }

  return data as StressTestInsertRow;
}

/**
 * Runs a single interactive stress scenario for the authenticated client,
 * persists a new historical row, and returns the computed result.
 */
export async function persistStressTestRun(
  client: AppClientRow,
  scenario: StressScenario,
  severity: InteractiveStressSeverity,
): Promise<PersistStressTestRunResult> {
  const context = await loadCurrentShieldContext(client.id);
  if (!context) {
    throw new Error("no_profile");
  }

  const { shieldRow, pillarRows, pillarScores, mitigation } = context;

  const result = runStressTest({
    adjustedShieldScore: toNumber(shieldRow.adjusted_shield_score),
    pillarScores,
    scenario,
    severity,
    mitigation,
  });

  let shieldScoreId = shieldRow.id;

  try {
    const inserted = await insertStressTestRow({
      shieldScoreId,
      clientId: client.id,
      result,
    });

    const scoreDrop = toNumber(inserted.pre_stress_score) -
      toNumber(inserted.post_stress_score);

    return {
      id: inserted.id,
      shield_score_id: inserted.shield_score_id,
      created_at: inserted.created_at,
      result,
      score_drop: scoreDrop,
      mitigation_notes: buildMitigationNotes(result.mitigationCredit),
    };
  } catch (err) {
    const pgError = err as { code?: string };
    if (pgError.code !== "23505") {
      throw err instanceof Error
        ? err
        : new Error("Failed to persist stress test run");
    }

    shieldScoreId = await cloneHistoricalShieldSnapshot(shieldRow, pillarRows);

    const inserted = await insertStressTestRow({
      shieldScoreId,
      clientId: client.id,
      result,
    });

    const scoreDrop = toNumber(inserted.pre_stress_score) -
      toNumber(inserted.post_stress_score);

    return {
      id: inserted.id,
      shield_score_id: inserted.shield_score_id,
      created_at: inserted.created_at,
      result,
      score_drop: scoreDrop,
      mitigation_notes: buildMitigationNotes(result.mitigationCredit),
    };
  }
}

export async function loadStressTestHistory(
  client: AppClientRow,
  limit = DEFAULT_HISTORY_LIMIT,
): Promise<StressTestHistoryEntry[]> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("stress_tests")
    .select(
      "id, shield_score_id, client_id, scenario, severity, pre_stress_score, post_stress_score, stress_penalty, mitigation_credit, affected_pillars, created_at",
    )
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load stress test history: ${error.message}`);
  }

  return ((data ?? []) as StressTestInsertRow[]).map((row) => {
    const mitigationCredit = toNumber(row.mitigation_credit);
    const preStressScore = toNumber(row.pre_stress_score);
    const postStressScore = toNumber(row.post_stress_score);

    return {
      id: row.id,
      client_id: row.client_id,
      shield_score_id: row.shield_score_id,
      scenario: row.scenario,
      severity: row.severity,
      pre_stress_score: preStressScore,
      post_stress_score: postStressScore,
      score_drop: preStressScore - postStressScore,
      affected_pillars: row.affected_pillars ?? {},
      mitigation_notes: buildMitigationNotes(mitigationCredit),
      created_at: row.created_at,
    };
  });
}
