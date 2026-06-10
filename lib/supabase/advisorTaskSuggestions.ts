import "server-only";

import { createAdminSupabaseClient } from "./admin";
import {
  loadClientReviewStatus,
  loadAdvisorReviewPipeline,
  type ClientReviewStatusDetail,
  type ReviewPipelineClient,
} from "./advisorReviewPipeline";
import {
  createAdvisorTask,
  isValidDateString,
  type AdvisorTaskPriority,
  type AdvisorTaskRecord,
  type AdvisorTaskType,
} from "./advisorTasks";
import {
  DOCUMENT_QUALITY_CATEGORIES,
  loadClientFileQuality,
  type ClientFileQuality,
  type DocumentQualityCategory,
} from "./clientFileQuality";
import type { AppClientRow } from "./userProfile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LOW_SHIELD_THRESHOLD = 60;
const ROADMAP_STALLED_MAX_PERCENT = 50;
const ROADMAP_STALLED_MIN_INCOMPLETE = 2;
export const TASK_SUGGESTION_TYPES = [
  "complete_discover",
  "upload_missing_document",
  "schedule_review",
  "address_high_risk_client",
  "follow_up_stalled_roadmap",
  "prepare_annual_review",
  "review_low_shield_score",
  "add_advisor_note",
] as const;

export type TaskSuggestionType = (typeof TASK_SUGGESTION_TYPES)[number];

export type TaskSuggestionSource =
  | "file_quality"
  | "review_pipeline"
  | "document_gap"
  | "discover"
  | "shield_score"
  | "risk"
  | "roadmap"
  | "advisor_note";

export type AdvisorTaskSuggestion = {
  id: string;
  client_id: string;
  client_name: string;
  suggestion_type: TaskSuggestionType;
  title: string;
  description: string;
  recommended_priority: AdvisorTaskPriority;
  recommended_due_date: string;
  task_type: AdvisorTaskType;
  source: TaskSuggestionSource;
  related_entity_type: string | null;
  related_entity_id: string | null;
  reason: string;
};

export type AdvisorTaskSuggestionsPayload = {
  suggestions: AdvisorTaskSuggestion[];
  summary: {
    totalCount: number;
    urgentCount: number;
    highCount: number;
    clientCount: number;
  };
};

export type CreateTaskFromSuggestionResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: false; reason: "invalid_suggestion" }
  | { ok: true; task: AdvisorTaskRecord; suggestion: AdvisorTaskSuggestion };

const SUGGESTION_TASK_TYPE: Record<TaskSuggestionType, AdvisorTaskType> = {
  complete_discover: "follow_up",
  upload_missing_document: "document",
  schedule_review: "review",
  address_high_risk_client: "risk",
  follow_up_stalled_roadmap: "roadmap",
  prepare_annual_review: "review",
  review_low_shield_score: "risk",
  add_advisor_note: "follow_up",
};

const SUGGESTION_TYPE_BY_TASK_TYPE: Partial<
  Record<AdvisorTaskType, TaskSuggestionType[]>
> = {
  review: ["schedule_review", "prepare_annual_review"],
  risk: ["address_high_risk_client", "review_low_shield_score"],
  roadmap: ["follow_up_stalled_roadmap"],
  document: ["upload_missing_document"],
  follow_up: ["complete_discover", "add_advisor_note"],
};

type OpenTaskSummary = {
  client_id: string | null;
  task_type: string;
  status: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
};

type RoadmapItemSummary = {
  client_id: string;
  status: "not_started" | "in_progress" | "completed";
};

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function endOfMonthDateString(): string {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const year = lastDay.getFullYear();
  const month = String(lastDay.getMonth() + 1).padStart(2, "0");
  const day = String(lastDay.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildSuggestionId(
  suggestionType: TaskSuggestionType,
  clientId: string,
  suffix?: string,
): string {
  return suffix
    ? `${suggestionType}:${clientId}:${suffix}`
    : `${suggestionType}:${clientId}`;
}

function priorityRank(priority: AdvisorTaskPriority): number {
  const ranks: Record<AdvisorTaskPriority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return ranks[priority];
}

function sortSuggestions(
  suggestions: AdvisorTaskSuggestion[],
): AdvisorTaskSuggestion[] {
  return [...suggestions].sort((a, b) => {
    const priorityDiff =
      priorityRank(a.recommended_priority) - priorityRank(b.recommended_priority);
    if (priorityDiff !== 0) return priorityDiff;
    return a.recommended_due_date.localeCompare(b.recommended_due_date);
  });
}

function summarizeSuggestions(
  suggestions: AdvisorTaskSuggestion[],
): AdvisorTaskSuggestionsPayload["summary"] {
  const clientIds = new Set(suggestions.map((s) => s.client_id));
  return {
    totalCount: suggestions.length,
    urgentCount: suggestions.filter((s) => s.recommended_priority === "urgent")
      .length,
    highCount: suggestions.filter((s) => s.recommended_priority === "high")
      .length,
    clientCount: clientIds.size,
  };
}

function isActiveTaskStatus(status: string): boolean {
  return status === "open" || status === "in_progress";
}

function isSuggestionSuppressed(
  suggestion: AdvisorTaskSuggestion,
  openTasks: OpenTaskSummary[],
): boolean {
  for (const task of openTasks) {
    if (task.client_id !== suggestion.client_id) continue;
    if (!isActiveTaskStatus(task.status)) continue;

    if (
      task.related_entity_type === "task_suggestion" &&
      task.related_entity_id === suggestion.id
    ) {
      return true;
    }

    const mappedTypes = SUGGESTION_TYPE_BY_TASK_TYPE[task.task_type as AdvisorTaskType];
    if (mappedTypes?.includes(suggestion.suggestion_type)) {
      if (suggestion.suggestion_type === "upload_missing_document") {
        if (
          task.related_entity_id === suggestion.related_entity_id &&
          task.related_entity_type === suggestion.related_entity_type
        ) {
          return true;
        }
        continue;
      }
      return true;
    }
  }

  return false;
}

function filterDuplicateSuggestions(
  suggestions: AdvisorTaskSuggestion[],
  openTasks: OpenTaskSummary[],
): AdvisorTaskSuggestion[] {
  return suggestions.filter(
    (suggestion) => !isSuggestionSuppressed(suggestion, openTasks),
  );
}

function computeRoadmapCompletion(items: RoadmapItemSummary[]): {
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

function isRoadmapStalled(
  items: RoadmapItemSummary[],
  clientStatus: AppClientRow["status"],
): boolean {
  const { percent, incompleteCount } = computeRoadmapCompletion(items);
  return (
    items.length > 0 &&
    incompleteCount >= ROADMAP_STALLED_MIN_INCOMPLETE &&
    percent <= ROADMAP_STALLED_MAX_PERCENT &&
    clientStatus !== "archived"
  );
}

function buildCompleteDiscoverSuggestion(
  client: AppClientRow,
): AdvisorTaskSuggestion {
  const today = todayDateString();
  const isOnboarding =
    client.status === "onboarding" || client.status === "prospect";

  return {
    id: buildSuggestionId("complete_discover", client.id),
    client_id: client.id,
    client_name: client.display_name,
    suggestion_type: "complete_discover",
    title: "Complete Discover profile",
    description:
      "Client has no completed Discover profile. Complete or import profile data before scoring and review.",
    recommended_priority: isOnboarding ? "medium" : "high",
    recommended_due_date: addDays(today, isOnboarding ? 14 : 7),
    task_type: SUGGESTION_TASK_TYPE.complete_discover,
    source: "discover",
    related_entity_type: null,
    related_entity_id: null,
    reason: "No Discover profile on file",
  };
}

function buildMissingShieldSuggestion(
  client: AppClientRow,
): AdvisorTaskSuggestion {
  const today = todayDateString();

  return {
    id: buildSuggestionId("review_low_shield_score", client.id),
    client_id: client.id,
    client_name: client.display_name,
    suggestion_type: "review_low_shield_score",
    title: "Run Shield Score computation",
    description:
      "Discover profile exists but no current Shield Score. Run computation to establish baseline risk posture.",
    recommended_priority: "high",
    recommended_due_date: addDays(today, 7),
    task_type: SUGGESTION_TASK_TYPE.review_low_shield_score,
    source: "shield_score",
    related_entity_type: null,
    related_entity_id: null,
    reason: "No Shield Score computed",
  };
}

function buildLowShieldScoreSuggestion(
  client: AppClientRow,
  score: number,
  rating: string | null,
): AdvisorTaskSuggestion {
  const today = todayDateString();

  return {
    id: buildSuggestionId("review_low_shield_score", client.id),
    client_id: client.id,
    client_name: client.display_name,
    suggestion_type: "review_low_shield_score",
    title: "Review low Shield Score",
    description: `Shield Score is ${score}${rating ? ` (${rating})` : ""}. Prioritise remediation actions and document the plan.`,
    recommended_priority: score < 50 ? "urgent" : "high",
    recommended_due_date: addDays(today, 7),
    task_type: SUGGESTION_TASK_TYPE.review_low_shield_score,
    source: "shield_score",
    related_entity_type: "shield_score",
    related_entity_id: null,
    reason: "Low Shield Score",
  };
}

function buildUploadDocumentSuggestion(
  client: AppClientRow,
  category: DocumentQualityCategory,
): AdvisorTaskSuggestion {
  const today = todayDateString();
  const label = DOCUMENT_CATEGORY_LABELS[category];

  return {
    id: buildSuggestionId("upload_missing_document", client.id, category),
    client_id: client.id,
    client_name: client.display_name,
    suggestion_type: "upload_missing_document",
    title: `Upload ${label.toLowerCase()}`,
    description: `${label} are not on file. Request or upload missing documents to improve file completeness.`,
    recommended_priority: "medium",
    recommended_due_date: addDays(today, 14),
    task_type: SUGGESTION_TASK_TYPE.upload_missing_document,
    source: "document_gap",
    related_entity_type: "document_category",
    related_entity_id: category,
    reason: `${label} not on file`,
  };
}

function buildScheduleReviewSuggestion(
  client: ReviewPipelineClient,
): AdvisorTaskSuggestion {
  const today = todayDateString();

  return {
    id: buildSuggestionId("schedule_review", client.clientId),
    client_id: client.clientId,
    client_name: client.displayName,
    suggestion_type: "schedule_review",
    title: "Schedule overdue annual review",
    description:
      "Annual Shield review is overdue. Schedule and complete the review immediately.",
    recommended_priority: "urgent",
    recommended_due_date: addDays(today, 3),
    task_type: SUGGESTION_TASK_TYPE.schedule_review,
    source: "review_pipeline",
    related_entity_type: null,
    related_entity_id: null,
    reason: "Annual review overdue",
  };
}

function buildPrepareAnnualReviewSuggestion(
  client: ReviewPipelineClient,
): AdvisorTaskSuggestion {
  const today = todayDateString();

  return {
    id: buildSuggestionId("prepare_annual_review", client.clientId),
    client_id: client.clientId,
    client_name: client.displayName,
    suggestion_type: "prepare_annual_review",
    title: "Prepare annual Shield review",
    description:
      "Client is due for annual review this cycle. Prepare materials and schedule the review meeting.",
    recommended_priority: "high",
    recommended_due_date: endOfMonthDateString(),
    task_type: SUGGESTION_TASK_TYPE.prepare_annual_review,
    source: "review_pipeline",
    related_entity_type: null,
    related_entity_id: null,
    reason: "Annual review due",
  };
}

function buildHighRiskSuggestion(
  client: AppClientRow,
  review: ClientReviewStatusDetail | null,
): AdvisorTaskSuggestion {
  const today = todayDateString();
  const scoreLabel =
    review?.adjustedShieldScore != null
      ? `Shield Score ${review.adjustedShieldScore}`
      : "elevated risk signals";

  return {
    id: buildSuggestionId("address_high_risk_client", client.id),
    client_id: client.id,
    client_name: client.display_name,
    suggestion_type: "address_high_risk_client",
    title: "Address high-risk client",
    description: `${client.display_name} flagged as high risk (${scoreLabel}). Create a remediation follow-up plan.`,
    recommended_priority: "urgent",
    recommended_due_date: addDays(today, 3),
    task_type: SUGGESTION_TASK_TYPE.address_high_risk_client,
    source: "risk",
    related_entity_type: null,
    related_entity_id: null,
    reason: "High-risk client without open task",
  };
}

function buildAdvisorNoteSuggestion(
  client: AppClientRow,
): AdvisorTaskSuggestion {
  const today = todayDateString();

  return {
    id: buildSuggestionId("add_advisor_note", client.id),
    client_id: client.id,
    client_name: client.display_name,
    suggestion_type: "add_advisor_note",
    title: "Document risk assessment note",
    description:
      "High-risk client has no recent advisor note. Record risk assessment and next steps.",
    recommended_priority: "high",
    recommended_due_date: addDays(today, 3),
    task_type: SUGGESTION_TASK_TYPE.add_advisor_note,
    source: "advisor_note",
    related_entity_type: null,
    related_entity_id: null,
    reason: "High-risk client without advisor note",
  };
}

function buildStalledRoadmapSuggestion(
  client: AppClientRow,
  incompleteCount: number,
  completionPercent: number,
): AdvisorTaskSuggestion {
  const today = todayDateString();

  return {
    id: buildSuggestionId("follow_up_stalled_roadmap", client.id),
    client_id: client.id,
    client_name: client.display_name,
    suggestion_type: "follow_up_stalled_roadmap",
    title: "Follow up on stalled roadmap",
    description: `${incompleteCount} open roadmap items · ${completionPercent}% complete. Review progress and unblock next actions.`,
    recommended_priority: "medium",
    recommended_due_date: addDays(today, 7),
    task_type: SUGGESTION_TASK_TYPE.follow_up_stalled_roadmap,
    source: "roadmap",
    related_entity_type: null,
    related_entity_id: null,
    reason: "Roadmap progress stalled",
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

async function loadOpenTasksForClients(
  clientIds: string[],
): Promise<OpenTaskSummary[]> {
  if (clientIds.length === 0) {
    return [];
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("advisor_tasks")
    .select("client_id, task_type, status, related_entity_type, related_entity_id")
    .in("client_id", clientIds)
    .in("status", ["open", "in_progress"]);

  if (error) {
    throw new Error(`Failed to load open advisor tasks: ${error.message}`);
  }

  return (data ?? []) as OpenTaskSummary[];
}

async function loadRoadmapByClient(
  clientIds: string[],
): Promise<Map<string, RoadmapItemSummary[]>> {
  if (clientIds.length === 0) {
    return new Map();
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("roadmap_items")
    .select("client_id, status")
    .in("client_id", clientIds)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to load roadmap items: ${error.message}`);
  }

  const byClient = new Map<string, RoadmapItemSummary[]>();
  for (const row of (data ?? []) as RoadmapItemSummary[]) {
    const existing = byClient.get(row.client_id) ?? [];
    existing.push(row);
    byClient.set(row.client_id, existing);
  }

  return byClient;
}

async function loadDiscoverCompletionByClient(
  clientIds: string[],
): Promise<Map<string, boolean>> {
  if (clientIds.length === 0) {
    return new Map();
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("discover_profiles")
    .select("client_id, completed_at")
    .in("client_id", clientIds)
    .eq("is_current", true);

  if (error) {
    throw new Error(`Failed to load discover profiles: ${error.message}`);
  }

  const map = new Map<string, boolean>();
  for (const row of (data ?? []) as { client_id: string; completed_at: string | null }[]) {
    map.set(row.client_id, row.completed_at != null);
  }

  return map;
}

async function loadDocumentCategoriesByClient(
  clientIds: string[],
): Promise<Map<string, Set<string>>> {
  if (clientIds.length === 0) {
    return new Map();
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("documents")
    .select("client_id, category")
    .in("client_id", clientIds)
    .eq("is_archived", false);

  if (error) {
    throw new Error(`Failed to load documents: ${error.message}`);
  }

  const byClient = new Map<string, Set<string>>();
  for (const row of (data ?? []) as { client_id: string; category: string }[]) {
    const existing = byClient.get(row.client_id) ?? new Set<string>();
    existing.add(row.category);
    byClient.set(row.client_id, existing);
  }

  return byClient;
}

const DOCUMENT_CATEGORY_LABELS: Record<DocumentQualityCategory, string> = {
  insurance: "Insurance documents",
  investment: "Investment statements",
  cpf: "CPF documents",
  estate: "Estate planning documents",
  loan: "Loan or liability statements",
  tax: "Tax documents",
};

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

function hasDocumentCategory(
  categories: Set<string>,
  qualityCategory: DocumentQualityCategory,
): boolean {
  return DOCUMENT_CATEGORY_MAP[qualityCategory].some((category) =>
    categories.has(category),
  );
}

function buildSuggestionsFromFileQuality(input: {
  client: AppClientRow;
  quality: ClientFileQuality;
  review: ClientReviewStatusDetail | null;
  discoverCompleted: boolean;
  documentCategories: Set<string>;
  roadmapItems: RoadmapItemSummary[];
}): AdvisorTaskSuggestion[] {
  const suggestions: AdvisorTaskSuggestion[] = [];
  const { quality } = input;

  if (!input.discoverCompleted) {
    suggestions.push(buildCompleteDiscoverSuggestion(input.client));
  }

  if (
    input.discoverCompleted &&
    quality.criticalGaps.includes("No Shield Score computed")
  ) {
    suggestions.push(buildMissingShieldSuggestion(input.client));
  }

  const shieldScore = input.review?.adjustedShieldScore ?? null;
  const shieldRating = input.review?.rating ?? null;

  if (shieldScore != null && shieldScore < LOW_SHIELD_THRESHOLD) {
    suggestions.push(
      buildLowShieldScoreSuggestion(
        input.client,
        shieldScore,
        shieldRating,
      ),
    );
  }

  for (const category of DOCUMENT_QUALITY_CATEGORIES) {
    if (!hasDocumentCategory(input.documentCategories, category)) {
      suggestions.push(
        buildUploadDocumentSuggestion(input.client, category),
      );
    }
  }

  if (quality.criticalGaps.includes("Annual review overdue")) {
    suggestions.push(
      buildScheduleReviewSuggestion({
        clientId: input.client.id,
        displayName: input.client.display_name,
        servicingState: "overdue",
      } as ReviewPipelineClient),
    );
  }

  if (quality.criticalGaps.includes("High-risk client without open task")) {
    suggestions.push(buildHighRiskSuggestion(input.client, input.review));
  }

  if (quality.criticalGaps.includes("High-risk client without advisor note")) {
    suggestions.push(buildAdvisorNoteSuggestion(input.client));
  }

  if (isRoadmapStalled(input.roadmapItems, input.client.status)) {
    const { percent, incompleteCount } = computeRoadmapCompletion(
      input.roadmapItems,
    );
    suggestions.push(
      buildStalledRoadmapSuggestion(
        input.client,
        incompleteCount,
        percent,
      ),
    );
  }

  return suggestions;
}

function buildSuggestionsFromReviewPipeline(
  pipeline: Awaited<ReturnType<typeof loadAdvisorReviewPipeline>>,
  clientsById: Map<string, AppClientRow>,
  reviewByClientId: Map<string, ClientReviewStatusDetail>,
  roadmapByClient: Map<string, RoadmapItemSummary[]>,
): AdvisorTaskSuggestion[] {
  const suggestions: AdvisorTaskSuggestion[] = [];
  const overdueIds = new Set<string>();
  const dueIds = new Set<string>();

  for (const client of pipeline.overdue) {
    overdueIds.add(client.clientId);
    suggestions.push(buildScheduleReviewSuggestion(client));
  }

  for (const client of pipeline.dueThisMonth) {
    if (overdueIds.has(client.clientId)) continue;
    dueIds.add(client.clientId);
    suggestions.push(buildPrepareAnnualReviewSuggestion(client));
  }

  for (const client of pipeline.onboarding) {
    const row = clientsById.get(client.clientId);
    if (row) {
      suggestions.push(buildCompleteDiscoverSuggestion(row));
    }
  }

  for (const client of pipeline.highPriority) {
    if (overdueIds.has(client.clientId) || dueIds.has(client.clientId)) {
      continue;
    }

    const row = clientsById.get(client.clientId);
    const review = reviewByClientId.get(client.clientId) ?? null;
    if (!row) continue;

    if (
      client.adjustedShieldScore != null &&
      client.adjustedShieldScore < LOW_SHIELD_THRESHOLD
    ) {
      suggestions.push(
        buildLowShieldScoreSuggestion(
          row,
          client.adjustedShieldScore,
          client.rating,
        ),
      );
    }

    if (review && !review.hasRecentAdvisorNote) {
      suggestions.push(buildAdvisorNoteSuggestion(row));
    }

    const roadmapItems = roadmapByClient.get(client.clientId) ?? [];
    if (isRoadmapStalled(roadmapItems, row.status)) {
      const { percent, incompleteCount } = computeRoadmapCompletion(roadmapItems);
      suggestions.push(
        buildStalledRoadmapSuggestion(row, incompleteCount, percent),
      );
    }
  }

  return suggestions;
}

function dedupeSuggestions(
  suggestions: AdvisorTaskSuggestion[],
): AdvisorTaskSuggestion[] {
  const seen = new Map<string, AdvisorTaskSuggestion>();

  for (const suggestion of suggestions) {
    const existing = seen.get(suggestion.id);
    if (!existing) {
      seen.set(suggestion.id, suggestion);
      continue;
    }

    if (
      priorityRank(suggestion.recommended_priority) <
      priorityRank(existing.recommended_priority)
    ) {
      seen.set(suggestion.id, suggestion);
    }
  }

  return Array.from(seen.values());
}

async function computeSuggestionsForClients(
  authUserId: string,
  userRole: "advisor" | "admin",
  clients: AppClientRow[],
): Promise<AdvisorTaskSuggestion[]> {
  if (clients.length === 0) {
    return [];
  }

  const clientIds = clients.map((client) => client.id);
  const clientsById = new Map(clients.map((client) => [client.id, client]));

  const [
    pipeline,
    openTasks,
    roadmapByClient,
    discoverByClient,
    documentsByClient,
  ] = await Promise.all([
    loadAdvisorReviewPipeline(authUserId, userRole),
    loadOpenTasksForClients(clientIds),
    loadRoadmapByClient(clientIds),
    loadDiscoverCompletionByClient(clientIds),
    loadDocumentCategoriesByClient(clientIds),
  ]);

  const reviewByClientId = new Map<string, ClientReviewStatusDetail>();
  const fileQualityResults = await Promise.all(
    clients.map(async (client) => {
      const [quality, review] = await Promise.all([
        loadClientFileQuality(authUserId, userRole, client.id),
        loadClientReviewStatus(authUserId, userRole, client.id),
      ]);

      if (review.ok) {
        reviewByClientId.set(client.id, review.review);
      }

      const discoverCompleted = discoverByClient.get(client.id) ?? false;
      const documentCategories =
        documentsByClient.get(client.id) ?? new Set<string>();
      const roadmapItems = roadmapByClient.get(client.id) ?? [];

      if (!quality.ok) {
        return [];
      }

      return buildSuggestionsFromFileQuality({
        client,
        quality: quality.quality,
        review: review.ok ? review.review : null,
        discoverCompleted,
        documentCategories,
        roadmapItems,
      });
    }),
  );

  const pipelineSuggestions = buildSuggestionsFromReviewPipeline(
    pipeline,
    clientsById,
    reviewByClientId,
    roadmapByClient,
  );

  const merged = dedupeSuggestions([
    ...fileQualityResults.flat(),
    ...pipelineSuggestions,
  ]);

  return sortSuggestions(filterDuplicateSuggestions(merged, openTasks));
}

/**
 * Loads computed task suggestions across all accessible clients.
 */
export async function loadAdvisorTaskSuggestions(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AdvisorTaskSuggestionsPayload> {
  const clients = await loadAccessibleClients(authUserId, userRole);
  const suggestions = await computeSuggestionsForClients(
    authUserId,
    userRole,
    clients,
  );

  return {
    suggestions,
    summary: summarizeSuggestions(suggestions),
  };
}

/**
 * Loads computed task suggestions for a single client workspace.
 */
export async function loadClientTaskSuggestions(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; payload: AdvisorTaskSuggestionsPayload }
> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const suggestions = await computeSuggestionsForClients(
    authUserId,
    userRole,
    [access.client],
  );

  return {
    ok: true,
    payload: {
      suggestions,
      summary: summarizeSuggestions(suggestions),
    },
  };
}

/**
 * Re-validates a suggestion and creates an advisor task on confirmation.
 */
export async function createTaskFromSuggestion(
  authUserId: string,
  userRole: "advisor" | "admin",
  input: {
    suggestionId: string;
    clientId: string;
    titleOverride?: string;
    dueDateOverride?: string | null;
    priorityOverride?: AdvisorTaskPriority;
  },
): Promise<CreateTaskFromSuggestionResult> {
  const access = await resolveAccessibleClient(
    authUserId,
    userRole,
    input.clientId,
  );

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const suggestions = await computeSuggestionsForClients(
    authUserId,
    userRole,
    [access.client],
  );

  const suggestion = suggestions.find(
    (item) => item.id === input.suggestionId && item.client_id === input.clientId,
  );

  if (!suggestion) {
    return { ok: false, reason: "invalid_suggestion" };
  }

  const title = input.titleOverride?.trim() || suggestion.title;

  let dueDate: string | null = suggestion.recommended_due_date;
  if (input.dueDateOverride !== undefined) {
    if (input.dueDateOverride === null || input.dueDateOverride === "") {
      dueDate = null;
    } else if (!isValidDateString(input.dueDateOverride)) {
      return { ok: false, reason: "invalid_suggestion" };
    } else {
      dueDate = input.dueDateOverride;
    }
  }

  const priority = input.priorityOverride ?? suggestion.recommended_priority;

  const result = await createAdvisorTask(authUserId, userRole, {
    clientId: suggestion.client_id,
    assignedToUserId: authUserId,
    title,
    description: suggestion.description,
    taskType: suggestion.task_type,
    priority,
    dueDate,
    relatedEntityType: "task_suggestion",
    relatedEntityId: suggestion.id,
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  return { ok: true, task: result.task, suggestion };
}
