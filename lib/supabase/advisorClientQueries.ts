import "server-only";

import type {
  AWRIResult,
  BenchmarkResult,
  ClientProfile,
  RoadmapItem,
  ShieldPillar,
  ShieldRating,
  ShieldScoreResult,
  StressTestResult,
} from "@/src/lib/scoring/types";

import { createAdminSupabaseClient } from "./admin";
import { resolveAccessibleClient } from "./advisorClientAccess";
import type { AdvisorActivityItem } from "./advisorQueries";
import { loadDashboardSnapshot } from "./dashboardQueries";
import type { AppClientRow, ClientStatus } from "./userProfile";

const RECENT_ACTIVITY_LIMIT = 20;
const STRESS_HISTORY_LIMIT = 20;
const REPORT_HISTORY_LIMIT = 10;

export type AdvisorDiscoverSummary = {
  completedAt: string | null;
  discoverScore: number | null;
  dataConfidenceFactor: number | null;
  completeness: number | null;
  version: number | null;
};

export type AdvisorDocumentMeta = {
  id: string;
  title: string;
  category: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
};

export type AdvisorStressHistoryEntry = {
  id: string;
  scenario: StressTestResult["scenario"];
  severity: StressTestResult["severity"];
  preStressScore: number;
  postStressScore: number;
  scoreDrop: number;
  createdAt: string;
};

export type AdvisorWealthBlueprintEntry = {
  id: string;
  title: string;
  adjustedShieldScore: number | null;
  awri: number | null;
  rating: ShieldRating | null;
  generatedAt: string;
};

export type AdvisorAnnualReviewEntry = {
  id: string;
  reviewYear: number;
  reviewLabel: string | null;
  adjustedShieldScore: number;
  rating: ShieldRating;
  generatedAt: string;
};

export type AdvisorClientRecord = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  currencyCode: string;
  onboardingStep: string | null;
  lastReviewAt: string | null;
  nextReviewDue: string | null;
  advisorUserId: string | null;
  advisorFullName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdvisorClientWorkspace = {
  client: AdvisorClientRecord;
  discover: AdvisorDiscoverSummary | null;
  profile: ClientProfile | null;
  shield: ShieldScoreResult | null;
  awri: AWRIResult | null;
  benchmark: BenchmarkResult | null;
  insights: {
    weakestPillar: ShieldPillar;
    strongestPillar: ShieldPillar;
  } | null;
  roadmap: RoadmapItem[];
  roadmapCompletionPercent: number;
  stressTests: StressTestResult[];
  topStressExposures: StressTestResult[];
  stressHistory: AdvisorStressHistoryEntry[];
  documents: AdvisorDocumentMeta[];
  wealthBlueprintHistory: AdvisorWealthBlueprintEntry[];
  annualReviewHistory: AdvisorAnnualReviewEntry[];
  recentActivity: AdvisorActivityItem[];
};

export type LoadAdvisorClientWorkspaceResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; workspace: AdvisorClientWorkspace };

type DiscoverSummaryRow = {
  completed_at: string | null;
  discover_score: number | string | null;
  data_confidence_factor: number | string | null;
  completeness: number | string | null;
  version: number | null;
};

type DocumentRow = {
  id: string;
  title: string;
  category: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

type StressHistoryRow = {
  id: string;
  scenario: StressTestResult["scenario"];
  severity: StressTestResult["severity"];
  pre_stress_score: number | string;
  post_stress_score: number | string;
  created_at: string;
};

type WealthBlueprintRow = {
  id: string;
  title: string;
  adjusted_shield_score: number | string | null;
  awri: number | string | null;
  rating: ShieldRating | null;
  generated_at: string;
};

type AnnualReviewRow = {
  id: string;
  review_year: number;
  review_label: string | null;
  adjusted_shield_score: number | string;
  rating: ShieldRating;
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

function mapClientRecord(
  client: AppClientRow,
  advisorFullName: string | null = null,
): AdvisorClientRecord {
  return {
    id: client.id,
    displayName: client.display_name,
    email: client.email,
    phone: client.phone,
    status: client.status,
    currencyCode: client.currency_code,
    onboardingStep: client.onboarding_step,
    lastReviewAt: client.last_review_at,
    nextReviewDue: client.next_review_due,
    advisorUserId: client.advisor_user_id,
    advisorFullName,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
  };
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

function computeRoadmapCompletion(items: RoadmapItem[]): number {
  if (items.length === 0) return 0;
  const completed = items.filter((item) => item.status === "completed").length;
  return Math.round((completed / items.length) * 100);
}

function mapDiscoverSummary(
  row: DiscoverSummaryRow | null,
): AdvisorDiscoverSummary | null {
  if (!row) return null;

  return {
    completedAt: row.completed_at,
    discoverScore: toNumber(row.discover_score),
    dataConfidenceFactor: toNumber(row.data_confidence_factor),
    completeness: toNumber(row.completeness),
    version: row.version,
  };
}

function mapDocumentMeta(row: DocumentRow): AdvisorDocumentMeta {
  return {
    id: row.id,
    title: row.title,
    category: row.category.replace(/_/g, " "),
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    createdAt: row.created_at,
  };
}

function mapStressHistory(row: StressHistoryRow): AdvisorStressHistoryEntry {
  const preStressScore = toNumber(row.pre_stress_score) ?? 0;
  const postStressScore = toNumber(row.post_stress_score) ?? 0;

  return {
    id: row.id,
    scenario: row.scenario,
    severity: row.severity,
    preStressScore,
    postStressScore,
    scoreDrop: preStressScore - postStressScore,
    createdAt: row.created_at,
  };
}

/**
 * Loads read-only advisor client workspace data.
 * Client access is verified server-side — advisors only see assigned clients.
 */
export async function loadAdvisorClientWorkspace(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<LoadAdvisorClientWorkspaceResult> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const { client } = access;
  const admin = createAdminSupabaseClient();

  const [
    dashboardSnapshot,
    discoverResult,
    documentsResult,
    stressHistoryResult,
    blueprintResult,
    annualReviewResult,
    auditResult,
  ] = await Promise.all([
    loadDashboardSnapshot(client),
    admin
      .from("discover_profiles")
      .select(
        "completed_at, discover_score, data_confidence_factor, completeness, version",
      )
      .eq("client_id", client.id)
      .eq("is_current", true)
      .maybeSingle(),
    admin
      .from("documents")
      .select(
        "id, title, category, file_name, mime_type, file_size_bytes, created_at",
      )
      .eq("client_id", client.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
    admin
      .from("stress_tests")
      .select(
        "id, scenario, severity, pre_stress_score, post_stress_score, created_at",
      )
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(STRESS_HISTORY_LIMIT),
    admin
      .from("wealth_blueprints")
      .select(
        "id, title, adjusted_shield_score, awri, rating, generated_at",
      )
      .eq("client_id", client.id)
      .eq("report_type", "wealth_architecture_blueprint")
      .order("generated_at", { ascending: false })
      .limit(REPORT_HISTORY_LIMIT),
    admin
      .from("annual_reviews")
      .select(
        "id, review_year, review_label, adjusted_shield_score, rating, generated_at",
      )
      .eq("client_id", client.id)
      .order("generated_at", { ascending: false })
      .limit(REPORT_HISTORY_LIMIT),
    admin
      .from("audit_logs")
      .select("id, client_id, action, entity_type, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(RECENT_ACTIVITY_LIMIT),
  ]);

  if (discoverResult.error) {
    throw new Error(
      `Failed to load discover profile: ${discoverResult.error.message}`,
    );
  }
  if (documentsResult.error) {
    throw new Error(`Failed to load documents: ${documentsResult.error.message}`);
  }
  if (stressHistoryResult.error) {
    throw new Error(
      `Failed to load stress history: ${stressHistoryResult.error.message}`,
    );
  }
  if (blueprintResult.error) {
    throw new Error(
      `Failed to load wealth blueprint history: ${blueprintResult.error.message}`,
    );
  }
  if (annualReviewResult.error) {
    throw new Error(
      `Failed to load annual review history: ${annualReviewResult.error.message}`,
    );
  }
  if (auditResult.error) {
    throw new Error(`Failed to load audit logs: ${auditResult.error.message}`);
  }

  const discover = mapDiscoverSummary(
    (discoverResult.data as DiscoverSummaryRow | null) ?? null,
  );

  const snapshot = dashboardSnapshot as Awaited<
    ReturnType<typeof loadDashboardSnapshot>
  >;

  const roadmap = snapshot?.roadmap ?? [];
  const recentActivity = ((auditResult.data ?? []) as AuditLogRow[]).map(
    (row) => ({
      id: row.id,
      clientId: row.client_id,
      clientDisplayName: client.display_name,
      action: row.action,
      entityType: row.entity_type,
      createdAt: row.created_at,
      summary: formatActivitySummary(row.action, row.entity_type),
    }),
  );

  let advisorFullName: string | null = null;
  if (client.advisor_user_id) {
    const { data: advisorRow } = await admin
      .from("users")
      .select("full_name")
      .eq("id", client.advisor_user_id)
      .maybeSingle();

    advisorFullName =
      (advisorRow as { full_name: string | null } | null)?.full_name ?? null;
  }

  const workspace: AdvisorClientWorkspace = {
    client: mapClientRecord(client, advisorFullName),
    discover,
    profile: snapshot?.client ?? null,
    shield: snapshot?.shield ?? null,
    awri: snapshot?.awri ?? null,
    benchmark: snapshot?.benchmark ?? null,
    insights: snapshot?.insights ?? null,
    roadmap,
    roadmapCompletionPercent: computeRoadmapCompletion(roadmap),
    stressTests: snapshot?.stressTests ?? [],
    topStressExposures: snapshot?.topStressExposures ?? [],
    stressHistory: ((stressHistoryResult.data ?? []) as StressHistoryRow[]).map(
      mapStressHistory,
    ),
    documents: ((documentsResult.data ?? []) as DocumentRow[]).map(
      mapDocumentMeta,
    ),
    wealthBlueprintHistory: (
      (blueprintResult.data ?? []) as WealthBlueprintRow[]
    ).map((row) => ({
      id: row.id,
      title: row.title,
      adjustedShieldScore: toNumber(row.adjusted_shield_score),
      awri: toNumber(row.awri),
      rating: row.rating,
      generatedAt: row.generated_at,
    })),
    annualReviewHistory: (
      (annualReviewResult.data ?? []) as AnnualReviewRow[]
    ).map((row) => ({
      id: row.id,
      reviewYear: row.review_year,
      reviewLabel: row.review_label,
      adjustedShieldScore: toNumber(row.adjusted_shield_score) ?? 0,
      rating: row.rating,
      generatedAt: row.generated_at,
    })),
    recentActivity,
  };

  return { ok: true, workspace };
}
