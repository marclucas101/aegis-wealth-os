import "server-only";

import type { ShieldRating } from "@/src/lib/scoring/types";

import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow, ClientStatus } from "./userProfile";

export type ReviewServicingState =
  | "onboarding"
  | "active"
  | "review_due"
  | "overdue"
  | "high_priority"
  | "completed";

export const MANUAL_REVIEW_STATUSES = [
  "onboarding",
  "active",
  "review_due",
  "archived",
] as const satisfies readonly ClientStatus[];

export type ManualReviewStatus = (typeof MANUAL_REVIEW_STATUSES)[number];

export type ReviewPipelineClient = {
  clientId: string;
  displayName: string;
  dbStatus: ClientStatus;
  servicingState: ReviewServicingState;
  adjustedShieldScore: number | null;
  rating: ShieldRating | null;
  lastAnnualReviewDate: string | null;
  nextRecommendedReviewDate: string | null;
  roadmapCompletionPercent: number;
  recommendedNextAction: string;
  priorityReasons: string[];
};

export type AdvisorReviewPipeline = {
  dueThisMonth: ReviewPipelineClient[];
  overdue: ReviewPipelineClient[];
  highPriority: ReviewPipelineClient[];
  onboarding: ReviewPipelineClient[];
  recentlyCompleted: ReviewPipelineClient[];
  summary: {
    dueThisMonthCount: number;
    overdueCount: number;
    highPriorityCount: number;
    onboardingCount: number;
    recentlyCompletedCount: number;
  };
};

export type ClientReviewStatusDetail = ReviewPipelineClient & {
  incompleteRoadmapCount: number;
  hasRecentAdvisorNote: boolean;
  hasSevereStress: boolean;
};

export type UpdateClientReviewStatusResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: false; reason: "no_change" }
  | {
      ok: true;
      clientId: string;
      oldStatus: ClientStatus;
      newStatus: ClientStatus;
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LOW_SHIELD_THRESHOLD = 60;
const HIGH_PRIORITY_RATINGS: ShieldRating[] = ["BB", "B"];
const REVIEW_DUE_MONTHS = 12;
const OVERDUE_MONTHS = 15;
const RECENTLY_COMPLETED_DAYS = 30;
const RECENT_NOTE_DAYS = 14;
const SEVERE_STRESS_POST_SCORE_THRESHOLD = 50;

type ShieldScoreSummary = {
  client_id: string;
  adjusted_shield_score: number | string;
  rating: ShieldRating;
};

type RoadmapSummary = {
  client_id: string;
  status: "not_started" | "in_progress" | "completed";
};

type AnnualReviewSummary = {
  client_id: string;
  generated_at: string;
};

type StressSummary = {
  client_id: string;
  severity: "mild" | "moderate" | "severe" | "extreme";
  post_stress_score: number | string;
};

type AdvisorNoteSummary = {
  client_id: string;
  created_at: string;
};

export type ClientReviewContext = {
  client: AppClientRow;
  shield: ShieldScoreSummary | undefined;
  roadmapItems: RoadmapSummary[];
  latestReview: AnnualReviewSummary | undefined;
  stressRows: StressSummary[];
  recentNote: AdvisorNoteSummary | undefined;
};

function isValidClientId(clientId: string): boolean {
  return UUID_RE.test(clientId);
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) {
    months -= 1;
  }
  return months;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function isSameCalendarMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isWithinDays(isoDate: string, days: number): boolean {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
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

function computeRoadmapCompletion(items: RoadmapSummary[]): {
  percent: number;
  incompleteCount: number;
} {
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

function isHighPrioritySignal(
  adjustedShieldScore: number | null,
  rating: ShieldRating | null,
): boolean {
  return (
    (adjustedShieldScore != null &&
      adjustedShieldScore < LOW_SHIELD_THRESHOLD) ||
    (rating != null && HIGH_PRIORITY_RATINGS.includes(rating))
  );
}

function buildPriorityReasons(input: {
  adjustedShieldScore: number | null;
  rating: ShieldRating | null;
  hasSevereStress: boolean;
  incompleteRoadmapCount: number;
  monthsSinceReview: number | null;
  hasAnnualReview: boolean;
  isOverdue: boolean;
  isReviewDue: boolean;
}): string[] {
  const reasons: string[] = [];

  if (input.isOverdue) {
    reasons.push("Annual review overdue");
  } else if (input.isReviewDue) {
    reasons.push("Annual review due");
  }

  if (!input.hasAnnualReview && input.isReviewDue) {
    reasons.push("No annual review on file");
  }

  if (
    input.adjustedShieldScore != null &&
    input.adjustedShieldScore < LOW_SHIELD_THRESHOLD
  ) {
    reasons.push("Low Shield Score");
  }

  if (input.rating != null && HIGH_PRIORITY_RATINGS.includes(input.rating)) {
    reasons.push("Weak rating");
  }

  if (input.hasSevereStress) {
    reasons.push("Severe stress exposure");
  }

  if (input.incompleteRoadmapCount > 0) {
    reasons.push("Incomplete roadmap items");
  }

  if (
    input.monthsSinceReview != null &&
    input.monthsSinceReview >= REVIEW_DUE_MONTHS &&
    !input.isOverdue
  ) {
    reasons.push("Review cycle exceeded 12 months");
  }

  return reasons;
}

function deriveRecommendedNextAction(input: {
  servicingState: ReviewServicingState;
  priorityReasons: string[];
  incompleteRoadmapCount: number;
  hasRecentAdvisorNote: boolean;
}): string {
  if (input.servicingState === "onboarding") {
    return "Complete client onboarding and Discover profile";
  }

  if (input.servicingState === "overdue") {
    return "Schedule overdue annual Shield review immediately";
  }

  if (input.servicingState === "review_due") {
    return "Schedule annual Shield review this month";
  }

  if (input.priorityReasons.includes("Severe stress exposure")) {
    return "Review stress test exposures and mitigation plan";
  }

  if (input.priorityReasons.includes("Low Shield Score")) {
    return "Prioritise Shield Score improvement actions";
  }

  if (input.incompleteRoadmapCount > 0) {
    return "Follow up on open roadmap items";
  }

  if (input.servicingState === "completed") {
    return "Confirm review outcomes and next servicing touchpoint";
  }

  if (input.hasRecentAdvisorNote) {
    return "Continue follow-up from recent advisor note";
  }

  return "Monitor client profile and schedule next review";
}

function deriveServicingState(input: {
  client: AppClientRow;
  monthsSinceReview: number | null;
  hasAnnualReview: boolean;
  isHighPriority: boolean;
  recentlyCompleted: boolean;
}): ReviewServicingState {
  const { client } = input;

  if (client.status === "archived") {
    return "active";
  }

  if (client.status === "onboarding" || client.status === "prospect") {
    return "onboarding";
  }

  if (input.recentlyCompleted) {
    return "completed";
  }

  if (
    input.monthsSinceReview != null &&
    input.monthsSinceReview >= OVERDUE_MONTHS
  ) {
    return "overdue";
  }

  if (
    input.monthsSinceReview != null &&
    input.monthsSinceReview >= REVIEW_DUE_MONTHS
  ) {
    return "review_due";
  }

  if (
    !input.hasAnnualReview &&
    (client.status === "active" || client.status === "review_due")
  ) {
    return "review_due";
  }

  if (client.status === "review_due") {
    return "review_due";
  }

  if (input.isHighPriority) {
    return "high_priority";
  }

  return "active";
}

function buildPipelineClient(ctx: ClientReviewContext): ReviewPipelineClient {
  const adjustedShieldScore = toNumber(
    ctx.shield?.adjusted_shield_score ?? null,
  );
  const rating = ctx.shield?.rating ?? null;
  const { percent: roadmapCompletionPercent, incompleteCount } =
    computeRoadmapCompletion(ctx.roadmapItems);

  const lastAnnualReviewDate = ctx.latestReview?.generated_at ?? null;
  const reviewReferenceDate = lastAnnualReviewDate
    ? new Date(lastAnnualReviewDate)
    : null;

  const monthsSinceReview =
    reviewReferenceDate && !Number.isNaN(reviewReferenceDate.getTime())
      ? monthsBetween(reviewReferenceDate, new Date())
      : null;

  const hasAnnualReview = lastAnnualReviewDate != null;
  const isOverdue =
    monthsSinceReview != null && monthsSinceReview >= OVERDUE_MONTHS;
  const isReviewDue =
    isOverdue ||
    (monthsSinceReview != null && monthsSinceReview >= REVIEW_DUE_MONTHS) ||
    (!hasAnnualReview &&
      (ctx.client.status === "active" || ctx.client.status === "review_due"));

  const recentlyCompleted =
    lastAnnualReviewDate != null &&
    isWithinDays(lastAnnualReviewDate, RECENTLY_COMPLETED_DAYS);

  const hasSevereStressFlag = isSevereStress(ctx.stressRows);
  const highPriority = isHighPrioritySignal(adjustedShieldScore, rating);

  const priorityReasons = buildPriorityReasons({
    adjustedShieldScore,
    rating,
    hasSevereStress: hasSevereStressFlag,
    incompleteRoadmapCount: incompleteCount,
    monthsSinceReview,
    hasAnnualReview,
    isOverdue,
    isReviewDue,
  });

  const servicingState = deriveServicingState({
    client: ctx.client,
    monthsSinceReview,
    hasAnnualReview,
    isHighPriority: highPriority,
    recentlyCompleted,
  });

  const nextRecommendedReviewDate = (() => {
    if (reviewReferenceDate && !Number.isNaN(reviewReferenceDate.getTime())) {
      return addMonths(reviewReferenceDate, REVIEW_DUE_MONTHS).toISOString();
    }

    if (ctx.client.next_review_due) {
      return new Date(ctx.client.next_review_due).toISOString();
    }

    if (
      ctx.client.status === "active" ||
      ctx.client.status === "review_due"
    ) {
      return new Date().toISOString();
    }

    return null;
  })();

  const hasRecentAdvisorNote =
    ctx.recentNote != null &&
    isWithinDays(ctx.recentNote.created_at, RECENT_NOTE_DAYS);

  return {
    clientId: ctx.client.id,
    displayName: ctx.client.display_name,
    dbStatus: ctx.client.status,
    servicingState,
    adjustedShieldScore,
    rating,
    lastAnnualReviewDate,
    nextRecommendedReviewDate,
    roadmapCompletionPercent,
    recommendedNextAction: deriveRecommendedNextAction({
      servicingState,
      priorityReasons,
      incompleteRoadmapCount: incompleteCount,
      hasRecentAdvisorNote,
    }),
    priorityReasons,
  };
}

async function loadAccessibleClients(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AppClientRow[]> {
  const admin = createAdminSupabaseClient();

  let query = admin
    .from("clients")
    .select("*")
    .neq("status", "archived")
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

async function loadClientReviewContexts(
  clients: AppClientRow[],
): Promise<ClientReviewContext[]> {
  if (clients.length === 0) {
    return [];
  }

  const clientIds = clients.map((client) => client.id);
  const admin = createAdminSupabaseClient();

  const [
    shieldResult,
    roadmapResult,
    annualReviewResult,
    stressResult,
    notesResult,
  ] = await Promise.all([
    admin
      .from("shield_scores")
      .select("client_id, adjusted_shield_score, rating")
      .in("client_id", clientIds)
      .eq("is_current", true),
    admin
      .from("roadmap_items")
      .select("client_id, status")
      .in("client_id", clientIds)
      .eq("is_active", true),
    admin
      .from("annual_reviews")
      .select("client_id, generated_at")
      .in("client_id", clientIds)
      .order("generated_at", { ascending: false }),
    admin
      .from("stress_tests")
      .select("client_id, severity, post_stress_score")
      .in("client_id", clientIds),
    admin
      .from("advisor_notes")
      .select("client_id, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false }),
  ]);

  if (shieldResult.error) {
    throw new Error(`Failed to load shield scores: ${shieldResult.error.message}`);
  }
  if (roadmapResult.error) {
    throw new Error(`Failed to load roadmap items: ${roadmapResult.error.message}`);
  }
  if (annualReviewResult.error) {
    throw new Error(
      `Failed to load annual reviews: ${annualReviewResult.error.message}`,
    );
  }
  if (stressResult.error) {
    throw new Error(`Failed to load stress tests: ${stressResult.error.message}`);
  }
  if (notesResult.error) {
    throw new Error(`Failed to load advisor notes: ${notesResult.error.message}`);
  }

  const shieldByClient = new Map<string, ShieldScoreSummary>();
  for (const row of (shieldResult.data ?? []) as ShieldScoreSummary[]) {
    shieldByClient.set(row.client_id, row);
  }

  const roadmapByClient = new Map<string, RoadmapSummary[]>();
  for (const row of (roadmapResult.data ?? []) as RoadmapSummary[]) {
    const existing = roadmapByClient.get(row.client_id) ?? [];
    existing.push(row);
    roadmapByClient.set(row.client_id, existing);
  }

  const latestReviewByClient = new Map<string, AnnualReviewSummary>();
  for (const row of (annualReviewResult.data ?? []) as AnnualReviewSummary[]) {
    if (!latestReviewByClient.has(row.client_id)) {
      latestReviewByClient.set(row.client_id, row);
    }
  }

  const stressByClient = new Map<string, StressSummary[]>();
  for (const row of (stressResult.data ?? []) as StressSummary[]) {
    const existing = stressByClient.get(row.client_id) ?? [];
    existing.push(row);
    stressByClient.set(row.client_id, existing);
  }

  const latestNoteByClient = new Map<string, AdvisorNoteSummary>();
  for (const row of (notesResult.data ?? []) as AdvisorNoteSummary[]) {
    if (!latestNoteByClient.has(row.client_id)) {
      latestNoteByClient.set(row.client_id, row);
    }
  }

  return clients.map((client) => ({
    client,
    shield: shieldByClient.get(client.id),
    roadmapItems: roadmapByClient.get(client.id) ?? [],
    latestReview: latestReviewByClient.get(client.id),
    stressRows: stressByClient.get(client.id) ?? [],
    recentNote: latestNoteByClient.get(client.id),
  }));
}

function isDueThisMonth(client: ReviewPipelineClient): boolean {
  if (
    client.servicingState !== "review_due" &&
    client.servicingState !== "high_priority"
  ) {
    return false;
  }

  if (!client.nextRecommendedReviewDate) {
    return client.servicingState === "review_due";
  }

  const dueDate = new Date(client.nextRecommendedReviewDate);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  return isSameCalendarMonth(dueDate, new Date());
}

/**
 * Batch-loads review pipeline inputs for multiple clients.
 */
export async function loadAdvisorClientReviewContexts(
  clients: AppClientRow[],
): Promise<ClientReviewContext[]> {
  return loadClientReviewContexts(clients);
}

/**
 * Builds the review pipeline from preloaded contexts (no extra queries).
 */
export function buildAdvisorReviewPipelineFromContexts(
  contexts: ClientReviewContext[],
): AdvisorReviewPipeline {
  const pipelineClients = contexts.map(buildPipelineClient);

  const dueThisMonth = pipelineClients
    .filter(isDueThisMonth)
    .sort((a, b) => {
      const aDate = a.nextRecommendedReviewDate
        ? new Date(a.nextRecommendedReviewDate).getTime()
        : 0;
      const bDate = b.nextRecommendedReviewDate
        ? new Date(b.nextRecommendedReviewDate).getTime()
        : 0;
      return aDate - bDate;
    });

  const overdue = pipelineClients
    .filter((client) => client.servicingState === "overdue")
    .sort((a, b) => {
      const aDate = a.lastAnnualReviewDate
        ? new Date(a.lastAnnualReviewDate).getTime()
        : 0;
      const bDate = b.lastAnnualReviewDate
        ? new Date(b.lastAnnualReviewDate).getTime()
        : 0;
      return aDate - bDate;
    });

  const highPriority = pipelineClients
    .filter(
      (client) =>
        client.servicingState === "high_priority" ||
        isHighPrioritySignal(client.adjustedShieldScore, client.rating),
    )
    .sort((a, b) => {
      const aScore = a.adjustedShieldScore ?? 100;
      const bScore = b.adjustedShieldScore ?? 100;
      return aScore - bScore;
    });

  const onboarding = pipelineClients.filter(
    (client) => client.servicingState === "onboarding",
  );

  const recentlyCompleted = pipelineClients
    .filter((client) => client.servicingState === "completed")
    .sort((a, b) => {
      const aDate = a.lastAnnualReviewDate
        ? new Date(a.lastAnnualReviewDate).getTime()
        : 0;
      const bDate = b.lastAnnualReviewDate
        ? new Date(b.lastAnnualReviewDate).getTime()
        : 0;
      return bDate - aDate;
    });

  return {
    dueThisMonth,
    overdue,
    highPriority,
    onboarding,
    recentlyCompleted,
    summary: {
      dueThisMonthCount: dueThisMonth.length,
      overdueCount: overdue.length,
      highPriorityCount: highPriority.length,
      onboardingCount: onboarding.length,
      recentlyCompletedCount: recentlyCompleted.length,
    },
  };
}

/**
 * Builds review status detail from a preloaded review context.
 */
export function buildClientReviewStatusDetailFromContext(
  ctx: ClientReviewContext,
): ClientReviewStatusDetail {
  const pipelineClient = buildPipelineClient(ctx);
  const { incompleteCount } = computeRoadmapCompletion(ctx.roadmapItems);

  return {
    ...pipelineClient,
    incompleteRoadmapCount: incompleteCount,
    hasRecentAdvisorNote:
      ctx.recentNote != null &&
      isWithinDays(ctx.recentNote.created_at, RECENT_NOTE_DAYS),
    hasSevereStress: isSevereStress(ctx.stressRows),
  };
}

/**
 * Loads the advisor review pipeline for accessible clients.
 * Client scope is resolved server-side from the authenticated advisor/admin.
 */
export async function loadAdvisorReviewPipeline(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AdvisorReviewPipeline> {
  const clients = await loadAccessibleClients(authUserId, userRole);
  const contexts = await loadClientReviewContexts(clients);
  return buildAdvisorReviewPipelineFromContexts(contexts);
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
  if (!isValidClientId(clientId)) {
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
 * Loads review status detail for a single client workspace.
 */
export async function loadClientReviewStatus(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; review: ClientReviewStatusDetail }
> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const contexts = await loadClientReviewContexts([access.client]);
  const pipelineClient = buildPipelineClient(contexts[0]!);
  const { incompleteCount } = computeRoadmapCompletion(
    contexts[0]!.roadmapItems,
  );

  return {
    ok: true,
    review: {
      ...pipelineClient,
      incompleteRoadmapCount: incompleteCount,
      hasRecentAdvisorNote:
        contexts[0]!.recentNote != null &&
        isWithinDays(contexts[0]!.recentNote.created_at, RECENT_NOTE_DAYS),
      hasSevereStress: isSevereStress(contexts[0]!.stressRows),
    },
  };
}

/**
 * Updates a client's manual review status (clients.status).
 * Does not modify annual review snapshots.
 */
export async function updateClientReviewStatus(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  newStatus: ManualReviewStatus,
): Promise<UpdateClientReviewStatusResult> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const { client } = access;

  if (client.status === newStatus) {
    return { ok: false, reason: "no_change" };
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("clients")
    .update({ status: newStatus } as never)
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to update client status: ${error.message}`);
  }

  return {
    ok: true,
    clientId,
    oldStatus: client.status,
    newStatus,
  };
}
