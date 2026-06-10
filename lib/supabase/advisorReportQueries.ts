import "server-only";

import type {
  AnnualReviewTimelineYear,
  WeakestPillarEntry,
} from "@/lib/supabase/moduleQueries";
import type { RoadmapStatusSummary } from "@/lib/supabase/reportPersistence";
import type {
  PillarScores,
  RoadmapItem,
  ShieldRating,
  StressTestResult,
} from "@/src/lib/scoring/types";

import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdvisorWealthBlueprintDetail = {
  id: string;
  title: string;
  generatedAt: string;
  adjustedShieldScore: number | null;
  awri: number | null;
  rating: ShieldRating | null;
  executiveSummary: string | null;
  pillarSummary: {
    pillarScores: PillarScores;
    weakestPillars: WeakestPillarEntry[];
  };
  roadmapSummary: RoadmapStatusSummary;
  stressSummary: {
    topExposures: StressTestResult[];
    preStressScore: number;
  };
};

export type AdvisorAnnualReviewDetail = {
  id: string;
  reviewYear: number;
  reviewLabel: string | null;
  generatedAt: string;
  adjustedShieldScore: number;
  rating: ShieldRating;
  projectedAdjustedScore: number | null;
  totalImprovement: number | null;
  weakestPillars: WeakestPillarEntry[];
  roadmapProgress: {
    completed: number;
    total: number;
    percent: number;
  };
  timeline: AnnualReviewTimelineYear[];
};

export type AdvisorReportAccessResult<T> =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; report: T };

type WealthBlueprintRow = {
  id: string;
  client_id: string;
  title: string;
  executive_summary: string | null;
  report_data: Record<string, unknown>;
  adjusted_shield_score: number | string | null;
  awri: number | string | null;
  rating: ShieldRating | null;
  generated_at: string;
};

type AnnualReviewRow = {
  id: string;
  client_id: string;
  review_year: number;
  review_label: string | null;
  adjusted_shield_score: number | string;
  rating: ShieldRating;
  projected_adjusted_score: number | string | null;
  total_improvement: number | string | null;
  weakest_pillars: WeakestPillarEntry[] | null;
  actions_completed: number;
  actions_total: number;
  timeline: AnnualReviewTimelineYear[] | null;
  generated_at: string;
};

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

function extractRoadmapFromReportData(
  reportData: Record<string, unknown>,
): RoadmapItem[] {
  const fromSummary = reportData.roadmapStatusSummary as
    | { items?: RoadmapItem[] }
    | undefined;
  if (fromSummary?.items?.length) {
    return fromSummary.items;
  }

  const roadmap = reportData.roadmap;
  return Array.isArray(roadmap) ? (roadmap as RoadmapItem[]) : [];
}

function sanitizeWealthBlueprintDetail(
  row: WealthBlueprintRow,
): AdvisorWealthBlueprintDetail {
  const reportData = row.report_data ?? {};
  const shield = reportData.shield as { pillarScores?: PillarScores; adjustedShieldScore?: number } | undefined;
  const pillarAnalysis = reportData.pillarAnalysis as
    | { pillarScores?: PillarScores; weakestPillars?: WeakestPillarEntry[] }
    | undefined;
  const stressTestSummary = reportData.stressTestSummary as
    | { topExposures?: StressTestResult[] }
    | undefined;
  const topStressExposures = reportData.topStressExposures as
    | StressTestResult[]
    | undefined;

  const pillarScores =
    pillarAnalysis?.pillarScores ??
    shield?.pillarScores ??
    ({} as PillarScores);
  const weakestPillars =
    pillarAnalysis?.weakestPillars ??
    (reportData.weakestPillars as WeakestPillarEntry[] | undefined) ??
    [];
  const topExposures =
    stressTestSummary?.topExposures ?? topStressExposures ?? [];
  const preStressScore =
    shield?.adjustedShieldScore ??
    toNumber(row.adjusted_shield_score) ??
    0;
  const roadmap = extractRoadmapFromReportData(reportData);
  const roadmapStatusSummary =
    (reportData.roadmapStatusSummary as RoadmapStatusSummary | undefined) ??
    buildRoadmapStatusSummary(roadmap);

  return {
    id: row.id,
    title: row.title,
    generatedAt: row.generated_at,
    adjustedShieldScore: toNumber(row.adjusted_shield_score),
    awri: toNumber(row.awri),
    rating: row.rating,
    executiveSummary: row.executive_summary,
    pillarSummary: {
      pillarScores,
      weakestPillars,
    },
    roadmapSummary: roadmapStatusSummary,
    stressSummary: {
      topExposures,
      preStressScore,
    },
  };
}

function sanitizeAnnualReviewDetail(
  row: AnnualReviewRow,
): AdvisorAnnualReviewDetail {
  const completed = row.actions_completed ?? 0;
  const total = row.actions_total ?? 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    id: row.id,
    reviewYear: row.review_year,
    reviewLabel: row.review_label,
    generatedAt: row.generated_at,
    adjustedShieldScore: toNumber(row.adjusted_shield_score) ?? 0,
    rating: row.rating,
    projectedAdjustedScore: toNumber(row.projected_adjusted_score),
    totalImprovement: toNumber(row.total_improvement),
    weakestPillars: row.weakest_pillars ?? [],
    roadmapProgress: {
      completed,
      total,
      percent,
    },
    timeline: row.timeline ?? [],
  };
}

async function resolveAccessibleClient(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; client: AppClientRow }
> {
  if (!isValidUuid(clientId)) {
    return { status: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client: ${error.message}`);
  }

  if (!data) {
    return { status: "not_found" };
  }

  const client = data as AppClientRow;

  if (userRole === "advisor" && client.advisor_user_id !== authUserId) {
    return { status: "forbidden" };
  }

  return { status: "ok", client };
}

/**
 * Loads a sanitized Wealth Blueprint snapshot for advisor viewing.
 * Excludes raw discover form data from the response.
 */
export async function loadAdvisorWealthBlueprintDetail(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  blueprintId: string,
): Promise<AdvisorReportAccessResult<AdvisorWealthBlueprintDetail>> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  if (!isValidUuid(blueprintId)) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("wealth_blueprints")
    .select(
      "id, client_id, title, executive_summary, report_data, adjusted_shield_score, awri, rating, generated_at",
    )
    .eq("id", blueprintId)
    .eq("client_id", clientId)
    .eq("report_type", "wealth_architecture_blueprint")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load wealth blueprint: ${error.message}`);
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  return {
    ok: true,
    report: sanitizeWealthBlueprintDetail(data as WealthBlueprintRow),
  };
}

/**
 * Loads a sanitized Annual Review snapshot for advisor viewing.
 */
export async function loadAdvisorAnnualReviewDetail(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  reviewId: string,
): Promise<AdvisorReportAccessResult<AdvisorAnnualReviewDetail>> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  if (!isValidUuid(reviewId)) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("annual_reviews")
    .select(
      "id, client_id, review_year, review_label, adjusted_shield_score, rating, projected_adjusted_score, total_improvement, weakest_pillars, actions_completed, actions_total, timeline, generated_at",
    )
    .eq("id", reviewId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load annual review: ${error.message}`);
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  return {
    ok: true,
    report: sanitizeAnnualReviewDetail(data as AnnualReviewRow),
  };
}
