import "server-only";

import type { ShieldRating } from "@/src/lib/scoring/types";

import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow, ClientStatus } from "./userProfile";

export type AdvisorRiskLevel = "low" | "medium" | "high";

export type AdvisorClientRow = {
  id: string;
  displayName: string;
  email: string | null;
  status: ClientStatus;
  adjustedShieldScore: number | null;
  rating: ShieldRating | null;
  discoverScore: number | null;
  dataConfidenceFactor: number | null;
  roadmapCompletionPercent: number;
  documentCount: number;
  lastActivityDate: string | null;
  riskLevel: AdvisorRiskLevel;
};

export type PriorityClient = {
  clientId: string;
  displayName: string;
  status: ClientStatus;
  adjustedShieldScore: number | null;
  rating: ShieldRating | null;
  reasons: string[];
  priorityScore: number;
};

export type AdvisorActivityItem = {
  id: string;
  clientId: string | null;
  clientDisplayName: string | null;
  action: string;
  entityType: string;
  createdAt: string;
  summary: string;
};

export type AdvisorOverview = {
  totalClients: number;
  activeClients: number;
  onboardingClients: number;
  averageShieldScore: number | null;
  highRiskClients: number;
  pendingRoadmapItems: number;
  documentsUploaded: number;
  recentActivity: AdvisorActivityItem[];
  priorityClients: PriorityClient[];
  clients: AdvisorClientRow[];
};

const WEAK_RATINGS: ShieldRating[] = ["BBB", "BB", "B"];
const LOW_SHIELD_THRESHOLD = 60;
const HIGH_RISK_SHIELD_THRESHOLD = 50;
const SEVERE_STRESS_POST_SCORE_THRESHOLD = 50;
const STALE_REVIEW_MONTHS = 12;
const RECENT_ACTIVITY_LIMIT = 20;
const PRIORITY_CLIENT_LIMIT = 8;

type ShieldScoreSummary = {
  client_id: string;
  adjusted_shield_score: number | string;
  rating: ShieldRating;
  computed_at: string;
};

type DiscoverSummary = {
  client_id: string;
  discover_score: number | string;
  data_confidence_factor: number | string;
  completed_at: string;
};

type RoadmapSummary = {
  client_id: string;
  status: "not_started" | "in_progress" | "completed";
};

type DocumentSummary = {
  client_id: string;
  created_at: string;
};

type StressSummary = {
  client_id: string;
  severity: "mild" | "moderate" | "severe" | "extreme";
  post_stress_score: number | string;
};

type AnnualReviewSummary = {
  client_id: string;
  generated_at: string;
};

type AuditLogRow = {
  id: string;
  client_id: string | null;
  action: string;
  entity_type: string;
  created_at: string;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isWeakRating(rating: ShieldRating | null): boolean {
  return rating != null && WEAK_RATINGS.includes(rating);
}

function isSevereStress(rows: StressSummary[]): boolean {
  return rows.some((row) => {
    const postScore = toNumber(row.post_stress_score);
    return (
      (row.severity === "severe" || row.severity === "extreme") &&
      postScore != null &&
      postScore < SEVERE_STRESS_POST_SCORE_THRESHOLD
    );
  });
}

function isStaleAnnualReview(
  client: AppClientRow,
  latestReview: AnnualReviewSummary | undefined,
): boolean {
  if (client.status === "review_due") {
    return true;
  }

  if (client.next_review_due) {
    const due = new Date(client.next_review_due);
    if (!Number.isNaN(due.getTime()) && due < new Date()) {
      return true;
    }
  }

  if (!latestReview) {
    return true;
  }

  const generatedAt = new Date(latestReview.generated_at);
  if (Number.isNaN(generatedAt.getTime())) {
    return true;
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - STALE_REVIEW_MONTHS);
  return generatedAt < cutoff;
}

function deriveRiskLevel(input: {
  adjustedShieldScore: number | null;
  rating: ShieldRating | null;
  hasSevereStress: boolean;
  status: ClientStatus;
  incompleteRoadmapCount: number;
  totalRoadmapCount: number;
}): AdvisorRiskLevel {
  if (
    input.status === "review_due" ||
    input.hasSevereStress ||
    (input.adjustedShieldScore != null &&
      input.adjustedShieldScore < HIGH_RISK_SHIELD_THRESHOLD) ||
    input.rating === "B" ||
    input.rating === "BB"
  ) {
    return "high";
  }

  if (
    (input.adjustedShieldScore != null &&
      input.adjustedShieldScore < LOW_SHIELD_THRESHOLD) ||
    input.rating === "BBB" ||
    (input.totalRoadmapCount > 0 &&
      input.incompleteRoadmapCount / input.totalRoadmapCount >= 0.5)
  ) {
    return "medium";
  }

  return "low";
}

function computeRoadmapCompletion(
  items: RoadmapSummary[],
): { percent: number; incompleteCount: number } {
  if (items.length === 0) {
    return { percent: 0, incompleteCount: 0 };
  }

  const completed = items.filter((item) => item.status === "completed").length;
  const incompleteCount = items.length - completed;
  return {
    percent: Math.round((completed / items.length) * 100),
    incompleteCount,
  };
}

function maxIsoDate(...dates: Array<string | null | undefined>): string | null {
  const valid = dates
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (valid.length === 0) {
    return null;
  }

  return new Date(Math.max(...valid.map((date) => date.getTime()))).toISOString();
}

function formatActivitySummary(action: string, entityType: string): string {
  const labels: Record<string, string> = {
    discover_profile_saved: "Discover profile saved",
    roadmap_status_updated: "Roadmap status updated",
    stress_test_run: "Stress test run",
    wealth_blueprint_saved: "Wealth blueprint generated",
    annual_review_saved: "Annual review saved",
    document_upload: "Document uploaded",
    document_deleted: "Document deleted",
  };

  return (
    labels[action] ??
    `${action.replace(/_/g, " ")} (${entityType.replace(/_/g, " ")})`
  );
}

function buildPriorityReasons(input: {
  adjustedShieldScore: number | null;
  rating: ShieldRating | null;
  hasSevereStress: boolean;
  incompleteRoadmapCount: number;
  staleAnnualReview: boolean;
}): string[] {
  const reasons: string[] = [];

  if (
    input.adjustedShieldScore != null &&
    input.adjustedShieldScore < LOW_SHIELD_THRESHOLD
  ) {
    reasons.push("Low Shield Score");
  }

  if (isWeakRating(input.rating)) {
    reasons.push("Weak rating");
  }

  if (input.hasSevereStress) {
    reasons.push("Severe stress exposure");
  }

  if (input.incompleteRoadmapCount > 0) {
    reasons.push("Incomplete roadmap items");
  }

  if (input.staleAnnualReview) {
    reasons.push("Stale annual review");
  }

  return reasons;
}

function priorityScore(reasons: string[]): number {
  const weights: Record<string, number> = {
    "Low Shield Score": 30,
    "Weak rating": 20,
    "Severe stress exposure": 25,
    "Incomplete roadmap items": 15,
    "Stale annual review": 10,
  };

  return reasons.reduce((total, reason) => total + (weights[reason] ?? 5), 0);
}

async function loadAccessibleClients(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AppClientRow[]> {
  const admin = createAdminSupabaseClient();

  let query = admin
    .from("clients")
    .select("*")
    .order("display_name", { ascending: true });

  if (userRole === "advisor") {
    query = query.eq("advisor_user_id", authUserId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load advisor clients: ${error.message}`);
  }

  return (data ?? []) as AppClientRow[];
}

/**
 * Loads read-only advisor dashboard overview for the authenticated user.
 * Clients are resolved server-side — never from browser-supplied identifiers.
 */
export async function loadAdvisorOverview(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AdvisorOverview> {
  const clients = await loadAccessibleClients(authUserId, userRole);

  if (clients.length === 0) {
    return {
      totalClients: 0,
      activeClients: 0,
      onboardingClients: 0,
      averageShieldScore: null,
      highRiskClients: 0,
      pendingRoadmapItems: 0,
      documentsUploaded: 0,
      recentActivity: [],
      priorityClients: [],
      clients: [],
    };
  }

  const clientIds = clients.map((client) => client.id);
  const clientNameById = new Map(
    clients.map((client) => [client.id, client.display_name]),
  );

  const admin = createAdminSupabaseClient();

  const [
    shieldResult,
    discoverResult,
    roadmapResult,
    documentsResult,
    stressResult,
    annualReviewResult,
    auditResult,
  ] = await Promise.all([
    admin
      .from("shield_scores")
      .select("client_id, adjusted_shield_score, rating, computed_at")
      .in("client_id", clientIds)
      .eq("is_current", true),
    admin
      .from("discover_profiles")
      .select(
        "client_id, discover_score, data_confidence_factor, completed_at",
      )
      .in("client_id", clientIds)
      .eq("is_current", true),
    admin
      .from("roadmap_items")
      .select("client_id, status")
      .in("client_id", clientIds)
      .eq("is_active", true),
    admin
      .from("documents")
      .select("client_id, created_at")
      .in("client_id", clientIds)
      .eq("is_archived", false),
    admin
      .from("stress_tests")
      .select("client_id, severity, post_stress_score")
      .in("client_id", clientIds),
    admin
      .from("annual_reviews")
      .select("client_id, generated_at")
      .in("client_id", clientIds)
      .order("generated_at", { ascending: false }),
    admin
      .from("audit_logs")
      .select("id, client_id, action, entity_type, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(RECENT_ACTIVITY_LIMIT),
  ]);

  if (shieldResult.error) {
    throw new Error(`Failed to load shield scores: ${shieldResult.error.message}`);
  }
  if (discoverResult.error) {
    throw new Error(
      `Failed to load discover profiles: ${discoverResult.error.message}`,
    );
  }
  if (roadmapResult.error) {
    throw new Error(`Failed to load roadmap items: ${roadmapResult.error.message}`);
  }
  if (documentsResult.error) {
    throw new Error(`Failed to load documents: ${documentsResult.error.message}`);
  }
  if (stressResult.error) {
    throw new Error(`Failed to load stress tests: ${stressResult.error.message}`);
  }
  if (annualReviewResult.error) {
    throw new Error(
      `Failed to load annual reviews: ${annualReviewResult.error.message}`,
    );
  }
  if (auditResult.error) {
    throw new Error(`Failed to load audit logs: ${auditResult.error.message}`);
  }

  const shieldByClient = new Map<string, ShieldScoreSummary>();
  for (const row of (shieldResult.data ?? []) as ShieldScoreSummary[]) {
    shieldByClient.set(row.client_id, row);
  }

  const discoverByClient = new Map<string, DiscoverSummary>();
  for (const row of (discoverResult.data ?? []) as DiscoverSummary[]) {
    discoverByClient.set(row.client_id, row);
  }

  const roadmapByClient = new Map<string, RoadmapSummary[]>();
  for (const row of (roadmapResult.data ?? []) as RoadmapSummary[]) {
    const existing = roadmapByClient.get(row.client_id) ?? [];
    existing.push(row);
    roadmapByClient.set(row.client_id, existing);
  }

  const documentsByClient = new Map<string, DocumentSummary[]>();
  for (const row of (documentsResult.data ?? []) as DocumentSummary[]) {
    const existing = documentsByClient.get(row.client_id) ?? [];
    existing.push(row);
    documentsByClient.set(row.client_id, existing);
  }

  const stressByClient = new Map<string, StressSummary[]>();
  for (const row of (stressResult.data ?? []) as StressSummary[]) {
    const existing = stressByClient.get(row.client_id) ?? [];
    existing.push(row);
    stressByClient.set(row.client_id, existing);
  }

  const latestReviewByClient = new Map<string, AnnualReviewSummary>();
  for (const row of (annualReviewResult.data ?? []) as AnnualReviewSummary[]) {
    if (!latestReviewByClient.has(row.client_id)) {
      latestReviewByClient.set(row.client_id, row);
    }
  }

  const clientRows: AdvisorClientRow[] = [];
  const priorityCandidates: PriorityClient[] = [];

  let pendingRoadmapItems = 0;
  let documentsUploaded = 0;
  const shieldScores: number[] = [];

  for (const client of clients) {
    const shield = shieldByClient.get(client.id);
    const discover = discoverByClient.get(client.id);
    const roadmapItems = roadmapByClient.get(client.id) ?? [];
    const documents = documentsByClient.get(client.id) ?? [];
    const stressRows = stressByClient.get(client.id) ?? [];
    const latestReview = latestReviewByClient.get(client.id);

    const adjustedShieldScore = toNumber(shield?.adjusted_shield_score ?? null);
    const rating = shield?.rating ?? null;
    const { percent: roadmapCompletionPercent, incompleteCount } =
      computeRoadmapCompletion(roadmapItems);
    const hasSevereStress = isSevereStress(stressRows);
    const staleAnnualReview = isStaleAnnualReview(client, latestReview);

    pendingRoadmapItems += incompleteCount;
    documentsUploaded += documents.length;

    if (adjustedShieldScore != null) {
      shieldScores.push(adjustedShieldScore);
    }

    const lastActivityDate = maxIsoDate(
      client.updated_at,
      shield?.computed_at,
      discover?.completed_at,
      latestReview?.generated_at,
      ...documents.map((document) => document.created_at),
    );

    const riskLevel = deriveRiskLevel({
      adjustedShieldScore,
      rating,
      hasSevereStress,
      status: client.status,
      incompleteRoadmapCount: incompleteCount,
      totalRoadmapCount: roadmapItems.length,
    });

    clientRows.push({
      id: client.id,
      displayName: client.display_name,
      email: client.email,
      status: client.status,
      adjustedShieldScore,
      rating,
      discoverScore: toNumber(discover?.discover_score ?? null),
      dataConfidenceFactor: toNumber(discover?.data_confidence_factor ?? null),
      roadmapCompletionPercent,
      documentCount: documents.length,
      lastActivityDate,
      riskLevel,
    });

    const reasons = buildPriorityReasons({
      adjustedShieldScore,
      rating,
      hasSevereStress,
      incompleteRoadmapCount: incompleteCount,
      staleAnnualReview,
    });

    if (reasons.length > 0) {
      priorityCandidates.push({
        clientId: client.id,
        displayName: client.display_name,
        status: client.status,
        adjustedShieldScore,
        rating,
        reasons,
        priorityScore: priorityScore(reasons),
      });
    }
  }

  const averageShieldScore =
    shieldScores.length > 0
      ? Math.round(
          (shieldScores.reduce((sum, score) => sum + score, 0) /
            shieldScores.length) *
            10,
        ) / 10
      : null;

  const recentActivity = ((auditResult.data ?? []) as AuditLogRow[]).map(
    (row) => ({
      id: row.id,
      clientId: row.client_id,
      clientDisplayName: row.client_id
        ? (clientNameById.get(row.client_id) ?? null)
        : null,
      action: row.action,
      entityType: row.entity_type,
      createdAt: row.created_at,
      summary: formatActivitySummary(row.action, row.entity_type),
    }),
  );

  const priorityClients = priorityCandidates
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, PRIORITY_CLIENT_LIMIT);

  return {
    totalClients: clients.length,
    activeClients: clients.filter((client) => client.status === "active").length,
    onboardingClients: clients.filter((client) =>
      ["onboarding", "prospect"].includes(client.status),
    ).length,
    averageShieldScore,
    highRiskClients: clientRows.filter((client) => client.riskLevel === "high")
      .length,
    pendingRoadmapItems,
    documentsUploaded,
    recentActivity,
    priorityClients,
    clients: clientRows,
  };
}
