import "server-only";

import type { ShieldRating } from "@/src/lib/scoring/types";

import { createAdminSupabaseClient } from "./admin";
import type { AdvisorRiskLevel } from "./advisorQueries";
import type { AppClientRow } from "./userProfile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LOW_SHIELD_THRESHOLD = 60;
const HIGH_RISK_SHIELD_THRESHOLD = 50;
const SEVERE_STRESS_POST_SCORE_THRESHOLD = 50;
const OVERDUE_MONTHS = 15;

export type ReadinessRating = "excellent" | "good" | "incomplete" | "poor";

export type DocumentQualityCategory =
  | "insurance"
  | "investment"
  | "cpf"
  | "estate"
  | "loan"
  | "tax";

export const DOCUMENT_QUALITY_CATEGORIES: DocumentQualityCategory[] = [
  "insurance",
  "investment",
  "cpf",
  "estate",
  "loan",
  "tax",
];

const DOCUMENT_CATEGORY_MAP: Record<
  DocumentQualityCategory,
  readonly string[]
> = {
  insurance: ["insurance_policy"],
  investment: ["investment_statement"],
  cpf: ["cpf"],
  estate: ["estate", "will", "trust"],
  loan: ["financial_statement"],
  tax: ["financial_statement", "other"],
};

const DOCUMENT_CATEGORY_LABELS: Record<DocumentQualityCategory, string> = {
  insurance: "Insurance documents",
  investment: "Investment statements",
  cpf: "CPF documents",
  estate: "Estate planning documents",
  loan: "Loan or liability statements",
  tax: "Tax documents",
};

type ChecklistItemId =
  | "client_profile"
  | "discover_profile"
  | "shield_score"
  | "pillar_analysis"
  | "roadmap"
  | "advisor_note"
  | "task"
  | "report"
  | "document_coverage"
  | "no_overdue_task";

const CHECKLIST_ITEMS: { id: ChecklistItemId; label: string }[] = [
  { id: "client_profile", label: "Client profile on file" },
  { id: "discover_profile", label: "Discover profile completed" },
  { id: "shield_score", label: "Shield Score computed" },
  { id: "pillar_analysis", label: "Pillar analysis available" },
  { id: "roadmap", label: "Wealth roadmap generated" },
  { id: "advisor_note", label: "Advisor note recorded" },
  { id: "task", label: "Advisor task tracked" },
  { id: "report", label: "Annual review or blueprint on file" },
  { id: "document_coverage", label: "Documents uploaded to vault" },
  { id: "no_overdue_task", label: "No critical overdue tasks" },
];

export type ClientFileQuality = {
  clientId: string;
  displayName: string;
  readinessScore: number;
  readinessRating: ReadinessRating;
  reviewReady: boolean;
  missingItems: string[];
  completedItems: string[];
  criticalGaps: string[];
  recommendedNextActions: string[];
};

export type ClientFileQualitySummary = {
  clientId: string;
  displayName: string;
  readinessScore: number;
  readinessRating: ReadinessRating;
  reviewReady: boolean;
  criticalGapCount: number;
};

export type AdvisorBookFileQuality = {
  averageReadinessScore: number | null;
  reviewReadyCount: number;
  incompleteFilesCount: number;
  criticalGapsCount: number;
  clientsNeedingCleanup: number;
  clients: ClientFileQualitySummary[];
};

type ShieldScoreSummary = {
  client_id: string;
  id: string;
  adjusted_shield_score: number | string;
  rating: ShieldRating;
};

type DiscoverSummary = {
  client_id: string;
  completed_at: string | null;
};

type ClientProfileSummary = {
  client_id: string;
};

type PillarScoreSummary = {
  shield_score_id: string;
  pillar: string;
};

type RoadmapSummary = {
  client_id: string;
  status: "not_started" | "in_progress" | "completed";
};

type DocumentSummary = {
  client_id: string;
  category: string;
};

type AdvisorNoteSummary = {
  client_id: string;
};

type TaskSummary = {
  client_id: string | null;
  status: string;
  due_date: string | null;
};

type StressTestSummary = {
  client_id: string;
  severity: "mild" | "moderate" | "severe" | "extreme";
  post_stress_score: number | string;
};

type AnnualReviewSummary = {
  client_id: string;
  generated_at: string;
};

export type ClientQualityContext = {
  client: AppClientRow;
  hasClientProfile: boolean;
  discoverCompleted: boolean;
  hasShieldScore: boolean;
  hasPillarAnalysis: boolean;
  hasRoadmap: boolean;
  hasAdvisorNote: boolean;
  hasTask: boolean;
  hasReport: boolean;
  documentCount: number;
  documentCategories: Set<string>;
  hasOverdueCriticalTask: boolean;
  riskLevel: AdvisorRiskLevel;
  hasOpenTask: boolean;
  reviewOverdue: boolean;
  adjustedShieldScore: number | null;
  rating: ShieldRating | null;
};

function isValidClientId(clientId: string): boolean {
  return UUID_RE.test(clientId);
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSevereStress(rows: StressTestSummary[]): boolean {
  return rows.some((row) => {
    const postScore = toNumber(row.post_stress_score);
    return (
      (row.severity === "severe" || row.severity === "extreme") &&
      postScore != null &&
      postScore < SEVERE_STRESS_POST_SCORE_THRESHOLD
    );
  });
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

function isReviewOverdue(
  client: AppClientRow,
  latestReview: AnnualReviewSummary | undefined,
): boolean {
  if (client.next_review_due) {
    const due = new Date(client.next_review_due);
    if (!Number.isNaN(due.getTime()) && due < new Date()) {
      return true;
    }
  }

  if (!latestReview) {
    return false;
  }

  const generatedAt = new Date(latestReview.generated_at);
  if (Number.isNaN(generatedAt.getTime())) {
    return false;
  }

  return monthsBetween(generatedAt, new Date()) >= OVERDUE_MONTHS;
}

function deriveRiskLevel(input: {
  adjustedShieldScore: number | null;
  rating: ShieldRating | null;
  hasSevereStress: boolean;
  status: AppClientRow["status"];
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

function hasDocumentCategory(
  categories: Set<string>,
  qualityCategory: DocumentQualityCategory,
): boolean {
  const mapped = DOCUMENT_CATEGORY_MAP[qualityCategory];
  return mapped.some((category) => categories.has(category));
}

function computeChecklistCompletion(ctx: ClientQualityContext): {
  completed: ChecklistItemId[];
  missing: ChecklistItemId[];
} {
  const completed: ChecklistItemId[] = [];
  const missing: ChecklistItemId[] = [];

  const checks: Record<ChecklistItemId, boolean> = {
    client_profile: ctx.hasClientProfile,
    discover_profile: ctx.discoverCompleted,
    shield_score: ctx.hasShieldScore,
    pillar_analysis: ctx.hasPillarAnalysis,
    roadmap: ctx.hasRoadmap,
    advisor_note: ctx.hasAdvisorNote,
    task: ctx.hasTask,
    report: ctx.hasReport,
    document_coverage: ctx.documentCount > 0,
    no_overdue_task: !ctx.hasOverdueCriticalTask,
  };

  for (const item of CHECKLIST_ITEMS) {
    if (checks[item.id]) {
      completed.push(item.id);
    } else {
      missing.push(item.id);
    }
  }

  return { completed, missing };
}

function deriveReadinessRating(
  score: number,
  criticalGaps: string[],
): ReadinessRating {
  if (criticalGaps.length > 0 || score < 40) {
    return "poor";
  }
  if (score >= 90) {
    return "excellent";
  }
  if (score >= 70) {
    return "good";
  }
  return "incomplete";
}

function buildCriticalGaps(ctx: ClientQualityContext): string[] {
  const gaps: string[] = [];

  if (!ctx.discoverCompleted) {
    gaps.push("No Discover profile on file");
  }

  if (!ctx.hasShieldScore) {
    gaps.push("No Shield Score computed");
  }

  if (ctx.documentCount === 0) {
    gaps.push("No documents uploaded");
  }

  if (ctx.reviewOverdue) {
    gaps.push("Annual review overdue");
  }

  if (ctx.riskLevel === "high" && !ctx.hasAdvisorNote) {
    gaps.push("High-risk client without advisor note");
  }

  if (ctx.riskLevel === "high" && !ctx.hasOpenTask) {
    gaps.push("High-risk client without open task");
  }

  return gaps;
}

function buildAdvisoryDocumentGaps(categories: Set<string>): string[] {
  const gaps: string[] = [];

  for (const category of DOCUMENT_QUALITY_CATEGORIES) {
    if (!hasDocumentCategory(categories, category)) {
      gaps.push(`${DOCUMENT_CATEGORY_LABELS[category]} not on file`);
    }
  }

  return gaps;
}

function buildRecommendedNextActions(input: {
  ctx: ClientQualityContext;
  missingChecklist: ChecklistItemId[];
  criticalGaps: string[];
  advisoryGaps: string[];
}): string[] {
  const actions: string[] = [];
  const { ctx, missingChecklist, criticalGaps, advisoryGaps } = input;

  if (criticalGaps.includes("No Discover profile on file")) {
    actions.push("Complete or import the client Discover profile");
  }

  if (criticalGaps.includes("No Shield Score computed")) {
    actions.push("Run Shield Score computation after Discover completion");
  }

  if (criticalGaps.includes("No documents uploaded")) {
    actions.push("Upload core client documents to the vault");
  }

  if (criticalGaps.includes("Annual review overdue")) {
    actions.push("Schedule overdue annual Shield review immediately");
  }

  if (criticalGaps.includes("High-risk client without advisor note")) {
    actions.push("Document risk assessment in an advisor note");
  }

  if (criticalGaps.includes("High-risk client without open task")) {
    actions.push("Create a follow-up task for high-risk remediation");
  }

  if (missingChecklist.includes("pillar_analysis")) {
    actions.push("Ensure pillar analysis is generated from Discover data");
  }

  if (missingChecklist.includes("roadmap")) {
    actions.push("Generate wealth roadmap actions for the client");
  }

  if (missingChecklist.includes("report")) {
    actions.push("Produce an annual review or wealth blueprint report");
  }

  if (missingChecklist.includes("no_overdue_task")) {
    actions.push("Resolve or reassign overdue advisor tasks");
  }

  if (advisoryGaps.length > 0 && actions.length < 5) {
    actions.push("Review advisory document gaps and request missing files");
  }

  if (actions.length === 0 && ctx.documentCount > 0) {
    actions.push("Client file is in good standing — monitor for next review cycle");
  }

  return actions.slice(0, 5);
}

function computeClientFileQuality(ctx: ClientQualityContext): ClientFileQuality {
  const { completed, missing } = computeChecklistCompletion(ctx);
  const criticalGaps = buildCriticalGaps(ctx);
  const advisoryGaps = buildAdvisoryDocumentGaps(ctx.documentCategories);

  const readinessScore = Math.round((completed.length / CHECKLIST_ITEMS.length) * 100);
  const readinessRating = deriveReadinessRating(readinessScore, criticalGaps);

  const reviewReady =
    criticalGaps.length === 0 &&
    readinessScore >= 80 &&
    ctx.discoverCompleted &&
    ctx.hasShieldScore &&
    ctx.documentCount > 0;

  const completedItems = completed.map(
    (id) => CHECKLIST_ITEMS.find((item) => item.id === id)!.label,
  );

  const missingItems = [
    ...missing.map((id) => CHECKLIST_ITEMS.find((item) => item.id === id)!.label),
    ...advisoryGaps,
  ];

  const recommendedNextActions = buildRecommendedNextActions({
    ctx,
    missingChecklist: missing,
    criticalGaps,
    advisoryGaps,
  });

  return {
    clientId: ctx.client.id,
    displayName: ctx.client.display_name,
    readinessScore,
    readinessRating,
    reviewReady,
    missingItems,
    completedItems,
    criticalGaps,
    recommendedNextActions,
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

async function loadClientQualityContexts(
  clients: AppClientRow[],
): Promise<ClientQualityContext[]> {
  if (clients.length === 0) {
    return [];
  }

  const clientIds = clients.map((client) => client.id);
  const admin = createAdminSupabaseClient();
  const today = todayDateString();

  const [
    profileResult,
    discoverResult,
    shieldResult,
    roadmapResult,
    documentsResult,
    notesResult,
    tasksResult,
    annualReviewResult,
    blueprintResult,
    stressResult,
  ] = await Promise.all([
    admin
      .from("client_profiles")
      .select("client_id")
      .in("client_id", clientIds)
      .eq("is_current", true),
    admin
      .from("discover_profiles")
      .select("client_id, completed_at")
      .in("client_id", clientIds)
      .eq("is_current", true),
    admin
      .from("shield_scores")
      .select("client_id, id, adjusted_shield_score, rating")
      .in("client_id", clientIds)
      .eq("is_current", true),
    admin
      .from("roadmap_items")
      .select("client_id, status")
      .in("client_id", clientIds)
      .eq("is_active", true),
    admin
      .from("documents")
      .select("client_id, category")
      .in("client_id", clientIds)
      .eq("is_archived", false),
    admin.from("advisor_notes").select("client_id").in("client_id", clientIds),
    admin
      .from("advisor_tasks")
      .select("client_id, status, due_date")
      .in("client_id", clientIds),
    admin
      .from("annual_reviews")
      .select("client_id, generated_at")
      .in("client_id", clientIds)
      .order("generated_at", { ascending: false }),
    admin
      .from("wealth_blueprints")
      .select("client_id")
      .in("client_id", clientIds)
      .eq("report_type", "wealth_architecture_blueprint"),
    admin
      .from("stress_tests")
      .select("client_id, severity, post_stress_score")
      .in("client_id", clientIds),
  ]);

  const errors = [
    profileResult.error,
    discoverResult.error,
    shieldResult.error,
    roadmapResult.error,
    documentsResult.error,
    notesResult.error,
    tasksResult.error,
    annualReviewResult.error,
    blueprintResult.error,
    stressResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(
      `Failed to load file quality data: ${errors[0]!.message}`,
    );
  }

  const shieldByClient = new Map<string, ShieldScoreSummary>();
  const shieldIds: string[] = [];
  for (const row of (shieldResult.data ?? []) as ShieldScoreSummary[]) {
    shieldByClient.set(row.client_id, row);
    shieldIds.push(row.id);
  }

  let pillarRows: PillarScoreSummary[] = [];
  if (shieldIds.length > 0) {
    const { data: pillarData, error: pillarError } = await admin
      .from("pillar_scores")
      .select("shield_score_id, pillar")
      .in("shield_score_id", shieldIds);

    if (pillarError) {
      throw new Error(
        `Failed to load pillar scores: ${pillarError.message}`,
      );
    }

    pillarRows = (pillarData ?? []) as PillarScoreSummary[];
  }

  const pillarCountByShieldId = new Map<string, number>();
  for (const row of pillarRows) {
    pillarCountByShieldId.set(
      row.shield_score_id,
      (pillarCountByShieldId.get(row.shield_score_id) ?? 0) + 1,
    );
  }

  const profileByClient = new Set<string>();
  for (const row of (profileResult.data ?? []) as ClientProfileSummary[]) {
    profileByClient.add(row.client_id);
  }

  const discoverByClient = new Map<string, DiscoverSummary>();
  for (const row of (discoverResult.data ?? []) as DiscoverSummary[]) {
    discoverByClient.set(row.client_id, row);
  }

  const roadmapByClient = new Set<string>();
  const roadmapItemsByClient = new Map<string, RoadmapSummary[]>();
  for (const row of (roadmapResult.data ?? []) as RoadmapSummary[]) {
    roadmapByClient.add(row.client_id);
    const existing = roadmapItemsByClient.get(row.client_id) ?? [];
    existing.push(row);
    roadmapItemsByClient.set(row.client_id, existing);
  }

  const documentsByClient = new Map<string, DocumentSummary[]>();
  for (const row of (documentsResult.data ?? []) as DocumentSummary[]) {
    const existing = documentsByClient.get(row.client_id) ?? [];
    existing.push(row);
    documentsByClient.set(row.client_id, existing);
  }

  const notesByClient = new Set<string>();
  for (const row of (notesResult.data ?? []) as AdvisorNoteSummary[]) {
    notesByClient.add(row.client_id);
  }

  const tasksByClient = new Map<string, TaskSummary[]>();
  for (const row of (tasksResult.data ?? []) as TaskSummary[]) {
    if (!row.client_id) continue;
    const existing = tasksByClient.get(row.client_id) ?? [];
    existing.push(row);
    tasksByClient.set(row.client_id, existing);
  }

  const annualReviewByClient = new Map<string, AnnualReviewSummary>();
  for (const row of (annualReviewResult.data ?? []) as AnnualReviewSummary[]) {
    if (!annualReviewByClient.has(row.client_id)) {
      annualReviewByClient.set(row.client_id, row);
    }
  }

  const blueprintByClient = new Set<string>();
  for (const row of (blueprintResult.data ?? []) as { client_id: string }[]) {
    blueprintByClient.add(row.client_id);
  }

  const stressByClient = new Map<string, StressTestSummary[]>();
  for (const row of (stressResult.data ?? []) as StressTestSummary[]) {
    const existing = stressByClient.get(row.client_id) ?? [];
    existing.push(row);
    stressByClient.set(row.client_id, existing);
  }

  return clients.map((client) => {
    const shield = shieldByClient.get(client.id);
    const adjustedShieldScore = toNumber(shield?.adjusted_shield_score ?? null);
    const rating = shield?.rating ?? null;
    const documents = documentsByClient.get(client.id) ?? [];
    const documentCategories = new Set(documents.map((doc) => doc.category));
    const tasks = tasksByClient.get(client.id) ?? [];
    const discover = discoverByClient.get(client.id);
    const latestReview = annualReviewByClient.get(client.id);
    const stressRows = stressByClient.get(client.id) ?? [];
    const roadmapItems = roadmapItemsByClient.get(client.id) ?? [];
    const incompleteRoadmapCount = roadmapItems.filter(
      (item) => item.status !== "completed",
    ).length;

    const hasTask = tasks.some(
      (task) =>
        task.status === "open" ||
        task.status === "in_progress" ||
        task.status === "completed",
    );

    const hasOpenTask = tasks.some(
      (task) => task.status === "open" || task.status === "in_progress",
    );

    const hasOverdueCriticalTask = tasks.some(
      (task) =>
        (task.status === "open" || task.status === "in_progress") &&
        task.due_date != null &&
        task.due_date < today,
    );

    const pillarCount = shield
      ? (pillarCountByShieldId.get(shield.id) ?? 0)
      : 0;

    const riskLevel = deriveRiskLevel({
      adjustedShieldScore,
      rating,
      hasSevereStress: isSevereStress(stressRows),
      status: client.status,
      incompleteRoadmapCount,
      totalRoadmapCount: roadmapItems.length,
    });

    return {
      client,
      hasClientProfile: profileByClient.has(client.id),
      discoverCompleted: discover?.completed_at != null,
      hasShieldScore: shield != null,
      hasPillarAnalysis: pillarCount >= 7,
      hasRoadmap: roadmapByClient.has(client.id),
      hasAdvisorNote: notesByClient.has(client.id),
      hasTask,
      hasReport:
        latestReview != null || blueprintByClient.has(client.id),
      documentCount: documents.length,
      documentCategories,
      hasOverdueCriticalTask,
      riskLevel,
      hasOpenTask,
      reviewOverdue: isReviewOverdue(client, latestReview),
      adjustedShieldScore,
      rating,
    };
  });
}

export function buildClientFileQualityFromContext(
  context: ClientQualityContext,
): ClientFileQuality {
  return computeClientFileQuality(context);
}

/**
 * Batch-loads quality inputs for multiple clients in a fixed query set.
 */
export async function loadAdvisorClientQualityContexts(
  clients: AppClientRow[],
): Promise<ClientQualityContext[]> {
  return loadClientQualityContexts(clients);
}

/**
 * Builds book-wide file quality from preloaded quality contexts (no extra queries).
 */
export function buildAdvisorBookFileQualityFromContexts(
  contexts: ClientQualityContext[],
): AdvisorBookFileQuality {
  if (contexts.length === 0) {
    return {
      averageReadinessScore: null,
      reviewReadyCount: 0,
      incompleteFilesCount: 0,
      criticalGapsCount: 0,
      clientsNeedingCleanup: 0,
      clients: [],
    };
  }

  const qualities = contexts.map(computeClientFileQuality);

  const scores = qualities.map((q) => q.readinessScore);
  const averageReadinessScore =
    scores.length > 0
      ? Math.round(
          (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10,
        ) / 10
      : null;

  const reviewReadyCount = qualities.filter((q) => q.reviewReady).length;
  const incompleteFilesCount = qualities.filter((q) => !q.reviewReady).length;
  const criticalGapsCount = qualities.reduce(
    (sum, q) => sum + q.criticalGaps.length,
    0,
  );
  const clientsNeedingCleanup = qualities.filter(
    (q) =>
      q.readinessRating === "poor" ||
      q.readinessRating === "incomplete" ||
      q.criticalGaps.length > 0,
  ).length;

  const clientSummaries: ClientFileQualitySummary[] = qualities.map((q) => ({
    clientId: q.clientId,
    displayName: q.displayName,
    readinessScore: q.readinessScore,
    readinessRating: q.readinessRating,
    reviewReady: q.reviewReady,
    criticalGapCount: q.criticalGaps.length,
  }));

  return {
    averageReadinessScore,
    reviewReadyCount,
    incompleteFilesCount,
    criticalGapsCount,
    clientsNeedingCleanup,
    clients: clientSummaries,
  };
}

/**
 * Loads accessible advisor book clients (server-side scope).
 */
export async function loadAdvisorAccessibleClients(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AppClientRow[]> {
  return loadAccessibleClients(authUserId, userRole);
}

/**
 * Loads file quality for a single client.
 * Access is verified server-side — advisors only see assigned clients.
 */
export async function loadClientFileQuality(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; quality: ClientFileQuality }
> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const contexts = await loadClientQualityContexts([access.client]);
  const quality = computeClientFileQuality(contexts[0]!);

  return { ok: true, quality };
}

/**
 * Loads book-wide file quality summary for accessible clients.
 */
export async function loadAdvisorBookFileQuality(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AdvisorBookFileQuality> {
  const clients = await loadAccessibleClients(authUserId, userRole);

  if (clients.length === 0) {
    return buildAdvisorBookFileQualityFromContexts([]);
  }

  const contexts = await loadClientQualityContexts(clients);
  return buildAdvisorBookFileQualityFromContexts(contexts);
}
