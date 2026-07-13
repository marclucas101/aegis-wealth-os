import "server-only";

import {
  CRM_V2_PROTECTION_MAX_EXTRACTIONS,
  CRM_V2_PROTECTION_MAX_POLICIES,
  CRM_V2_PROTECTION_MAX_VERSIONS,
  CRM_V2_PROTECTION_STALE_DAYS,
} from "@/lib/crm-v2/constants";
import { buildExtractionConfidenceWarnings } from "@/lib/crm-v2/protection/extractionMapper";
import {
  buildVersionHash,
  findDuplicateCandidates,
  maskPolicyNumber,
  type ProtectionDuplicateCandidateInput,
} from "@/lib/crm-v2/protection/deduplication";
import {
  initialExtractionReviewState,
  isPortfolioEligibleState,
  isValidVerificationState,
  reviewSubmittedState,
  validateVerificationTransition,
  verificationStateLabel,
  type CrmProtectionVerificationState,
} from "@/lib/crm-v2/protection/verificationLifecycle";
import type {
  AdviserProtectionExtractionDetailDto,
  AdviserProtectionExtractionSummaryDto,
  AdviserProtectionExtractedFieldsDto,
  AdviserProtectionPolicyDetailDto,
  AdviserProtectionPolicySummaryDto,
  AdviserProtectionPortfolioDto,
  AdviserProtectionVersionDto,
  ClientProtectionPolicyDetailDto,
  ClientProtectionPolicySummaryDto,
  ClientProtectionPortfolioDto,
  CrmProtectionAppointmentPreparationDto,
  CrmProtectionCorrectionCategory,
  CrmProtectionCoverageCategory,
  CrmProtectionPolicyCategory,
  CrmProtectionPolicyStatus,
  CrmProtectionPremiumFrequency,
} from "@/lib/crm-v2/protection/types";
import {
  CRM_PROTECTION_COVERAGE_CATEGORIES,
  CRM_PROTECTION_POLICY_CATEGORIES,
  CRM_PROTECTION_POLICY_STATUSES,
  CRM_PROTECTION_PREMIUM_FREQUENCIES,
} from "@/lib/crm-v2/protection/types";
import { createClientServiceRequest } from "@/lib/crm-v2/service/service";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import type { ProtectionReportInput } from "@/src/features/advisor-console/protection-report/types";
import { mapProtectionReportToExtractions } from "@/lib/crm-v2/protection/extractionMapper";

export type CrmProtectionResult<T> =
  | { ok: false; reason: "not_found" | "forbidden" | "validation" | "conflict"; error?: string }
  | { ok: true; data: T };

type PolicyRow = {
  id: string;
  client_id: string;
  adviser_user_id: string;
  insurer: string;
  display_name: string;
  policy_category: string;
  policy_owner: string;
  life_assured: string;
  policy_status: string;
  policy_ref_masked: string | null;
  policy_start_date: string | null;
  maturity_or_expiry_date: string | null;
  source_document_id: string | null;
  current_confirmed_version_id: string | null;
  archived_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  policy_id: string;
  version_number: number;
  verification_state: string;
  effective_date: string | null;
  sum_assured: number | null;
  sum_assured_currency: string;
  premium: number | null;
  premium_frequency: string | null;
  policy_term: string | null;
  premium_term: string | null;
  coverage_components: unknown;
  riders: unknown;
  source_extraction_id: string | null;
  adviser_reviewer_id: string | null;
  confirmed_at: string | null;
  correction_reason: string | null;
  superseded_at: string | null;
  structured_snapshot: unknown;
  version_hash: string | null;
  created_at: string;
  updated_at: string;
};

type ExtractionRow = {
  id: string;
  client_id: string;
  adviser_user_id: string;
  source_document_id: string | null;
  source_report_policy_key: string | null;
  extraction_method: string;
  extraction_status: string;
  extracted_fields: unknown;
  confidence_warnings: unknown;
  adviser_review_status: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  resulting_policy_id: string | null;
  resulting_version_id: string | null;
  idempotency_key: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

function sanitizeText(value: string, max: number): string {
  return value.replace(/<[^>]*>/g, "").trim().slice(0, max);
}

function policyCategoryLabel(category: string): string {
  return category.replace(/_/g, " ");
}

function policyStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function premiumFrequencyLabel(freq: string | null): string | null {
  if (!freq) return null;
  return freq.replace(/_/g, " ");
}

function parseCoverageComponents(raw: unknown): AdviserProtectionVersionDto["coverageComponents"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      const category = String(row.category ?? "other") as CrmProtectionCoverageCategory;
      return {
        category: (CRM_PROTECTION_COVERAGE_CATEGORIES as readonly string[]).includes(category)
          ? category
          : "other",
        categoryLabel: String(row.categoryLabel ?? category.replace(/_/g, " ")),
        amount: typeof row.amount === "number" ? row.amount : null,
        currency: String(row.currency ?? "SGD"),
        durationLabel: row.durationLabel ? String(row.durationLabel) : null,
        insurerWording: row.insurerWording ? String(row.insurerWording).slice(0, 500) : null,
        isRider: Boolean(row.isRider),
      };
    })
    .slice(0, 30);
}

function parseRiders(raw: unknown): AdviserProtectionVersionDto["riders"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        riderLabel: String(row.riderLabel ?? "Rider").slice(0, 200),
        category: row.category
          ? (String(row.category) as CrmProtectionCoverageCategory)
          : null,
        amount: typeof row.amount === "number" ? row.amount : null,
        currency: String(row.currency ?? "SGD"),
      };
    })
    .slice(0, 20);
}

function parseExtractedFields(raw: unknown): AdviserProtectionExtractedFieldsDto | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const policyCategory = String(row.policyCategory ?? "other") as CrmProtectionPolicyCategory;
  const policyStatus = String(row.policyStatus ?? "unknown") as CrmProtectionPolicyStatus;
  const premiumFrequency = row.premiumFrequency
    ? (String(row.premiumFrequency) as CrmProtectionPremiumFrequency)
    : null;
  return {
    insurer: String(row.insurer ?? ""),
    displayName: String(row.displayName ?? ""),
    policyCategory: (CRM_PROTECTION_POLICY_CATEGORIES as readonly string[]).includes(policyCategory)
      ? policyCategory
      : "other",
    policyOwner: String(row.policyOwner ?? ""),
    lifeAssured: String(row.lifeAssured ?? ""),
    policyStatus: (CRM_PROTECTION_POLICY_STATUSES as readonly string[]).includes(policyStatus)
      ? policyStatus
      : "unknown",
    policyRefMasked: row.policyRefMasked ? String(row.policyRefMasked) : null,
    policyStartDate: row.policyStartDate ? String(row.policyStartDate) : null,
    maturityOrExpiryDate: row.maturityOrExpiryDate ? String(row.maturityOrExpiryDate) : null,
    sumAssured: typeof row.sumAssured === "number" ? row.sumAssured : null,
    sumAssuredCurrency: String(row.sumAssuredCurrency ?? "SGD"),
    premium: typeof row.premium === "number" ? row.premium : null,
    premiumFrequency:
      premiumFrequency &&
      (CRM_PROTECTION_PREMIUM_FREQUENCIES as readonly string[]).includes(premiumFrequency)
        ? premiumFrequency
        : null,
    policyTerm: row.policyTerm ? String(row.policyTerm) : null,
    premiumTerm: row.premiumTerm ? String(row.premiumTerm) : null,
    coverageComponents: parseCoverageComponents(row.coverageComponents),
    riders: parseRiders(row.riders),
  };
}

function mapVersionDto(row: VersionRow): AdviserProtectionVersionDto {
  const state = isValidVerificationState(row.verification_state)
    ? row.verification_state
    : "provisional";
  return {
    versionId: row.id,
    versionNumber: row.version_number,
    verificationState: state,
    verificationStateLabel: verificationStateLabel(state),
    effectiveDate: row.effective_date,
    sumAssured: row.sum_assured,
    sumAssuredCurrency: row.sum_assured_currency,
    premium: row.premium,
    premiumFrequency: row.premium_frequency as CrmProtectionPremiumFrequency | null,
    policyTerm: row.policy_term,
    premiumTerm: row.premium_term,
    coverageComponents: parseCoverageComponents(row.coverage_components),
    riders: parseRiders(row.riders),
    confirmedAt: row.confirmed_at,
    correctionReason: row.correction_reason,
    supersededAt: row.superseded_at,
  };
}

function isStaleVerified(lastVerifiedAt: string | null): boolean {
  if (!lastVerifiedAt) return true;
  const verified = new Date(lastVerifiedAt);
  if (Number.isNaN(verified.getTime())) return true;
  const cutoff = Date.now() - CRM_V2_PROTECTION_STALE_DAYS * 24 * 60 * 60 * 1000;
  return verified.getTime() < cutoff;
}

async function recordProtectionEvent(input: {
  clientId: string;
  adviserUserId: string;
  eventType: string;
  entityType: "policy" | "version" | "extraction";
  entityId: string;
  actorUserId: string;
  actorRole: "adviser" | "client" | "system";
  safeMetadata?: Record<string, unknown>;
  requestId?: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin.from("protection_domain_events").insert({
    client_id: input.clientId,
    adviser_user_id: input.adviserUserId,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    occurred_at: new Date().toISOString(),
    safe_metadata: input.safeMetadata ?? {},
    request_id: input.requestId ?? null,
  } as never);
}

async function loadPoliciesForClient(clientId: string): Promise<PolicyRow[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("protection_policies")
    .select("*")
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(CRM_V2_PROTECTION_MAX_POLICIES + 1);
  return (data as PolicyRow[] | null) ?? [];
}

async function loadExtractionsForClient(clientId: string): Promise<ExtractionRow[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("protection_extractions")
    .select("*")
    .eq("client_id", clientId)
    .not("adviser_review_status", "in", "(rejected,archived,confirmed,corrected)")
    .order("created_at", { ascending: false })
    .limit(CRM_V2_PROTECTION_MAX_EXTRACTIONS + 1);
  return (data as ExtractionRow[] | null) ?? [];
}

async function loadVersionRow(versionId: string): Promise<VersionRow | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("protection_policy_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  return (data as VersionRow | null) ?? null;
}

async function loadDocumentTitle(documentId: string | null): Promise<string | null> {
  if (!documentId) return null;
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("documents")
    .select("title")
    .eq("id", documentId)
    .maybeSingle();
  const row = data as { title?: string } | null;
  return row?.title ? String(row.title) : null;
}

function buildCoverageSummary(components: AdviserProtectionVersionDto["coverageComponents"]): string {
  if (components.length === 0) return "Coverage on file";
  return components
    .slice(0, 4)
    .map((c) => c.categoryLabel)
    .join(", ");
}

export async function loadAdviserProtectionPortfolio(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
}): Promise<CrmProtectionResult<AdviserProtectionPortfolioDto>> {
  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const client = access.client;
  const [policies, extractions] = await Promise.all([
    loadPoliciesForClient(client.id),
    loadExtractionsForClient(client.id),
  ]);

  const bounded =
    policies.length > CRM_V2_PROTECTION_MAX_POLICIES ||
    extractions.length > CRM_V2_PROTECTION_MAX_EXTRACTIONS;
  const policyRows = policies.slice(0, CRM_V2_PROTECTION_MAX_POLICIES);
  const extractionRows = extractions.slice(0, CRM_V2_PROTECTION_MAX_EXTRACTIONS);

  const versionIds = policyRows
    .map((p) => p.current_confirmed_version_id)
    .filter((id): id is string => Boolean(id));
  const versionsById = new Map<string, VersionRow>();
  if (versionIds.length > 0) {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("protection_policy_versions")
      .select("*")
      .in("id", versionIds);
    for (const row of (data as VersionRow[] | null) ?? []) {
      versionsById.set(row.id, row);
    }
  }

  const duplicateInputs: ProtectionDuplicateCandidateInput[] = policyRows.map((p) => ({
    policyId: p.id,
    insurer: p.insurer,
    policyRefMasked: p.policy_ref_masked,
    policyCategory: p.policy_category as CrmProtectionPolicyCategory,
    policyStartDate: p.policy_start_date,
    lifeAssured: p.life_assured,
    policyOwner: p.policy_owner,
  }));

  const policySummaries: AdviserProtectionPolicySummaryDto[] = [];
  let confirmedCount = 0;
  let missingSourceCount = 0;
  let upcomingExpiryCount = 0;
  let lastPortfolioVerifiedAt: string | null = null;

  for (const policy of policyRows) {
    const version = policy.current_confirmed_version_id
      ? versionsById.get(policy.current_confirmed_version_id) ?? null
      : null;
    const verificationState = version?.verification_state ?? "provisional";
    const isConfirmed = version && isPortfolioEligibleState(verificationState as CrmProtectionVerificationState);
    if (isConfirmed) confirmedCount += 1;
    if (!policy.source_document_id) missingSourceCount += 1;
    if (policy.maturity_or_expiry_date) {
      const expiry = new Date(policy.maturity_or_expiry_date);
      const horizon = Date.now() + 90 * 24 * 60 * 60 * 1000;
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() <= horizon) {
        upcomingExpiryCount += 1;
      }
    }
    const lastVerified = version?.confirmed_at ?? null;
    if (lastVerified && (!lastPortfolioVerifiedAt || lastVerified > lastPortfolioVerifiedAt)) {
      lastPortfolioVerifiedAt = lastVerified;
    }

    policySummaries.push({
      policyId: policy.id,
      insurer: policy.insurer,
      displayName: policy.display_name,
      policyCategory: policy.policy_category as CrmProtectionPolicyCategory,
      policyCategoryLabel: policyCategoryLabel(policy.policy_category),
      policyOwner: policy.policy_owner,
      lifeAssured: policy.life_assured,
      policyStatus: policy.policy_status as CrmProtectionPolicyStatus,
      policyStatusLabel: policyStatusLabel(policy.policy_status),
      policyRefMasked: policy.policy_ref_masked,
      policyStartDate: policy.policy_start_date,
      maturityOrExpiryDate: policy.maturity_or_expiry_date,
      currentVersionNumber: version?.version_number ?? null,
      verificationState,
      verificationStateLabel: isValidVerificationState(verificationState)
        ? verificationStateLabel(verificationState)
        : "Unknown",
      lastVerifiedAt: version?.confirmed_at ?? null,
      premium: version?.premium ?? null,
      premiumFrequency: (version?.premium_frequency as CrmProtectionPremiumFrequency) ?? null,
      sumAssured: version?.sum_assured ?? null,
      sumAssuredCurrency: version?.sum_assured_currency ?? "SGD",
      sourceDocumentAvailable: Boolean(policy.source_document_id),
      sourceDocumentStatusLabel: policy.source_document_id ? "On file" : "Missing source",
      hasProvisionalExtraction: extractionRows.some(
        (e) =>
          e.resulting_policy_id === policy.id &&
          ["provisional", "awaiting_review"].includes(e.adviser_review_status),
      ),
      clientCorrectionPending: false,
      isStale: isStaleVerified(version?.confirmed_at ?? null),
      workflowHref: `/advisor-v2/relationships/${client.id}/protection?policyId=${policy.id}`,
    });
  }

  const awaitingVerification: AdviserProtectionExtractionSummaryDto[] = extractionRows
    .filter((e) => ["provisional", "awaiting_review"].includes(e.adviser_review_status))
    .map((e) => {
      const fields = parseExtractedFields(e.extracted_fields);
      const candidates = fields
        ? findDuplicateCandidates(fields, duplicateInputs).map((c) => c.policyId)
        : [];
      return {
        extractionId: e.id,
        extractionMethod: e.extraction_method as AdviserProtectionExtractionSummaryDto["extractionMethod"],
        extractionMethodLabel: e.extraction_method.replace(/_/g, " "),
        reviewStatus: e.adviser_review_status,
        reviewStatusLabel: isValidVerificationState(e.adviser_review_status)
          ? verificationStateLabel(e.adviser_review_status)
          : e.adviser_review_status,
        insurer: fields?.insurer ?? null,
        displayName: fields?.displayName ?? null,
        policyCategory: fields?.policyCategory ?? null,
        confidenceWarnings: Array.isArray(e.confidence_warnings)
          ? (e.confidence_warnings as string[]).slice(0, 10)
          : [],
        sourceDocumentAvailable: Boolean(e.source_document_id),
        duplicateCandidatePolicyIds: candidates.slice(0, 5),
        createdAt: e.created_at,
        workflowHref: `/advisor-v2/relationships/${client.id}/protection?extractionId=${e.id}`,
      };
    });

  return {
    ok: true,
    data: {
      relationshipId: client.id,
      clientDisplayName: client.display_name,
      portfolioSummary: {
        confirmedPolicyCount: confirmedCount,
        provisionalExtractionCount: extractionRows.filter((e) => e.adviser_review_status === "provisional")
          .length,
        awaitingVerificationCount: awaitingVerification.length,
        missingSourceDocumentCount: missingSourceCount,
        pendingCorrectionRequestCount: 0,
        lastPortfolioVerifiedAt,
        upcomingExpiryCount,
      },
      policies: policySummaries,
      awaitingVerification,
      missingDocuments: policySummaries.filter((p) => !p.sourceDocumentAvailable),
      bounded,
    },
  };
}

export async function createProtectionExtractionsFromReport(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  report: ProtectionReportInput;
  sourceDocumentId?: string | null;
  idempotencyKey: string;
  requestId?: string;
}): Promise<CrmProtectionResult<{ extractionIds: string[]; skipped: number }>> {
  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const client = access.client;
  const admin = createAdminSupabaseClient();
  const mapped = mapProtectionReportToExtractions(input.report).slice(
    0,
    CRM_V2_PROTECTION_MAX_EXTRACTIONS,
  );
  const extractionIds: string[] = [];
  let skipped = 0;

  for (const item of mapped) {
    const idempotencyKey = `${input.idempotencyKey}:${item.sourcePolicyKey}`;
    const { data: existingRaw } = await admin
      .from("protection_extractions")
      .select("id")
      .eq("client_id", client.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    const existing = existingRaw as { id: string } | null;
    if (existing?.id) {
      extractionIds.push(String(existing.id));
      skipped += 1;
      continue;
    }

    const warnings = buildExtractionConfidenceWarnings(item.fields, item.warnings);
    const reviewStatus = initialExtractionReviewState();
    const { data: insertedRaw, error } = await admin
      .from("protection_extractions")
      .insert({
        client_id: client.id,
        adviser_user_id: client.advisor_user_id ?? input.authUserId,
        source_document_id: input.sourceDocumentId ?? null,
        source_report_policy_key: item.sourcePolicyKey,
        extraction_method: "protection_report",
        extraction_status: "completed",
        extracted_fields: item.fields,
        confidence_warnings: warnings,
        adviser_review_status: reviewStatus,
        idempotency_key: idempotencyKey,
        version: 1,
      } as never)
      .select("id")
      .single();
    const inserted = insertedRaw as { id: string } | null;

    if (error || !inserted?.id) {
      return { ok: false, reason: "validation", error: "Failed to store extraction" };
    }

    extractionIds.push(String(inserted.id));
    await recordProtectionEvent({
      clientId: client.id,
      adviserUserId: client.advisor_user_id ?? input.authUserId,
      eventType: "extraction_created",
      entityType: "extraction",
      entityId: String(inserted.id),
      actorUserId: input.authUserId,
      actorRole: "adviser",
      safeMetadata: { method: "protection_report", warnings: warnings.length },
      requestId: input.requestId,
    });
  }

  await writeAuditLog({
    userId: input.authUserId,
    action: "crm_protection_extractions_created",
    entityType: "protection_extraction",
    clientId: client.id,
    metadata: { count: extractionIds.length, skipped },
  });

  return { ok: true, data: { extractionIds, skipped } };
}

export async function getAdviserProtectionExtraction(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  extractionId: string;
}): Promise<CrmProtectionResult<AdviserProtectionExtractionDetailDto>> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("protection_extractions")
    .select("*")
    .eq("id", input.extractionId)
    .maybeSingle();
  const row = data as ExtractionRow | null;
  if (!row) return { ok: false, reason: "not_found" };

  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    row.client_id,
  );
  if (access.status !== "ok") {
    return { ok: false, reason: access.status === "forbidden" ? "forbidden" : "not_found" };
  }

  const fields = parseExtractedFields(row.extracted_fields);
  if (!fields) return { ok: false, reason: "validation" };

  const policies = await loadPoliciesForClient(row.client_id);
  const candidates = findDuplicateCandidates(
    fields,
    policies.map((p) => ({
      policyId: p.id,
      insurer: p.insurer,
      policyRefMasked: p.policy_ref_masked,
      policyCategory: p.policy_category as CrmProtectionPolicyCategory,
      policyStartDate: p.policy_start_date,
      lifeAssured: p.life_assured,
      policyOwner: p.policy_owner,
    })),
  ).map((c) => c.policyId);

  const docTitle = await loadDocumentTitle(row.source_document_id);

  return {
    ok: true,
    data: {
      extractionId: row.id,
      relationshipId: row.client_id,
      reviewStatus: row.adviser_review_status,
      reviewStatusLabel: isValidVerificationState(row.adviser_review_status)
        ? verificationStateLabel(row.adviser_review_status)
        : row.adviser_review_status,
      extractionMethod: row.extraction_method as AdviserProtectionExtractionDetailDto["extractionMethod"],
      extractedFields: fields,
      confidenceWarnings: Array.isArray(row.confidence_warnings)
        ? (row.confidence_warnings as string[]).slice(0, 20)
        : [],
      duplicateCandidatePolicyIds: candidates.slice(0, 5),
      sourceDocumentId: row.source_document_id,
      sourceDocumentTitle: docTitle,
      sourceDocumentAvailable: Boolean(row.source_document_id),
      resultingPolicyId: row.resulting_policy_id,
      resultingVersionId: row.resulting_version_id,
      version: row.version,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      rejectionReason: row.rejection_reason,
    },
  };
}

async function supersedeCurrentVersion(policy: PolicyRow, admin: ReturnType<typeof createAdminSupabaseClient>): Promise<void> {
  if (!policy.current_confirmed_version_id) return;
  await admin
    .from("protection_policy_versions")
    .update({
      verification_state: "superseded",
      superseded_at: new Date().toISOString(),
    } as never)
    .eq("id", policy.current_confirmed_version_id)
    .eq("verification_state", "confirmed");
}

export async function confirmProtectionExtraction(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  extractionId: string;
  expectedVersion: number;
  matchPolicyId?: string | null;
  correctedFields?: Partial<AdviserProtectionExtractedFieldsDto> | null;
  correctionReason?: string | null;
  requestId?: string;
}): Promise<CrmProtectionResult<{ policyId: string; versionId: string }>> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("protection_extractions")
    .select("*")
    .eq("id", input.extractionId)
    .maybeSingle();
  const row = data as ExtractionRow | null;
  if (!row) return { ok: false, reason: "not_found" };

  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    row.client_id,
  );
  if (access.status !== "ok") {
    return { ok: false, reason: access.status === "forbidden" ? "forbidden" : "not_found" };
  }

  if (row.version !== input.expectedVersion) {
    return { ok: false, reason: "conflict", error: "Stale extraction review" };
  }

  if (row.resulting_version_id && ["confirmed", "corrected"].includes(row.adviser_review_status)) {
    return {
      ok: true,
      data: {
        policyId: row.resulting_policy_id!,
        versionId: row.resulting_version_id,
      },
    };
  }

  const baseFields = parseExtractedFields(row.extracted_fields);
  if (!baseFields) return { ok: false, reason: "validation" };

  const fields: AdviserProtectionExtractedFieldsDto = {
    ...baseFields,
    ...(input.correctedFields ?? {}),
    policyRefMasked: input.correctedFields?.policyRefMasked
      ? maskPolicyNumber(String(input.correctedFields.policyRefMasked)) ?? baseFields.policyRefMasked
      : baseFields.policyRefMasked,
  };

  const fromState = isValidVerificationState(row.adviser_review_status)
    ? row.adviser_review_status
    : "provisional";
  const toState: CrmProtectionVerificationState = input.correctedFields
    ? "corrected"
    : "confirmed";

  try {
    if (fromState === "provisional") {
      validateVerificationTransition({
        fromState,
        toState: reviewSubmittedState(),
        actorRole: "adviser",
      });
    }
    validateVerificationTransition({ fromState: reviewSubmittedState(), toState, actorRole: "adviser" });
  } catch {
    try {
      validateVerificationTransition({ fromState, toState, actorRole: "adviser" });
    } catch {
      return { ok: false, reason: "validation", error: "Invalid verification transition" };
    }
  }

  let policyId = input.matchPolicyId ?? row.resulting_policy_id;
  let policy: PolicyRow | null = null;

  if (policyId) {
    const { data: existing } = await admin
      .from("protection_policies")
      .select("*")
      .eq("id", policyId)
      .eq("client_id", row.client_id)
      .maybeSingle();
    policy = (existing as PolicyRow | null) ?? null;
    if (!policy) return { ok: false, reason: "not_found" };
    await supersedeCurrentVersion(policy, admin);
  } else {
    const { data: created, error } = await admin
      .from("protection_policies")
      .insert({
        client_id: row.client_id,
        adviser_user_id: row.adviser_user_id,
        insurer: sanitizeText(fields.insurer, 120),
        display_name: sanitizeText(fields.displayName, 200),
        policy_category: fields.policyCategory,
        policy_owner: sanitizeText(fields.policyOwner, 120),
        life_assured: sanitizeText(fields.lifeAssured, 120),
        policy_status: fields.policyStatus,
        policy_ref_masked: fields.policyRefMasked,
        policy_start_date: fields.policyStartDate,
        maturity_or_expiry_date: fields.maturityOrExpiryDate,
        source_document_id: row.source_document_id,
        version: 1,
      } as never)
      .select("*")
      .single();
    if (error || !created) return { ok: false, reason: "validation" };
    policy = created as PolicyRow;
    policyId = policy.id;
  }

  const { count } = await admin
    .from("protection_policy_versions")
    .select("id", { count: "exact", head: true })
    .eq("policy_id", policyId);
  const versionNumber = (count ?? 0) + 1;
  const snapshot = { ...fields };
  const versionHash = buildVersionHash(snapshot as unknown as Record<string, unknown>);

  const { data: versionRowRaw, error: versionError } = await admin
    .from("protection_policy_versions")
    .insert({
      policy_id: policyId,
      version_number: versionNumber,
      verification_state: toState,
      effective_date: fields.policyStartDate,
      sum_assured: fields.sumAssured,
      sum_assured_currency: fields.sumAssuredCurrency,
      premium: fields.premium,
      premium_frequency: fields.premiumFrequency,
      policy_term: fields.policyTerm,
      premium_term: fields.premiumTerm,
      coverage_components: fields.coverageComponents,
      riders: fields.riders,
      source_extraction_id: row.id,
      adviser_reviewer_id: input.authUserId,
      confirmed_at: new Date().toISOString(),
      correction_reason: input.correctionReason ? sanitizeText(input.correctionReason, 500) : null,
      structured_snapshot: snapshot,
      version_hash: versionHash,
    } as never)
    .select("id")
    .single();
  const versionRow = versionRowRaw as { id: string } | null;

  if (versionError || !versionRow?.id) {
    return { ok: false, reason: "validation" };
  }

  await admin
    .from("protection_policies")
    .update({
      current_confirmed_version_id: versionRow.id,
      insurer: sanitizeText(fields.insurer, 120),
      display_name: sanitizeText(fields.displayName, 200),
      policy_category: fields.policyCategory,
      policy_owner: sanitizeText(fields.policyOwner, 120),
      life_assured: sanitizeText(fields.lifeAssured, 120),
      policy_status: fields.policyStatus,
      policy_ref_masked: fields.policyRefMasked,
      policy_start_date: fields.policyStartDate,
      maturity_or_expiry_date: fields.maturityOrExpiryDate,
      source_document_id: row.source_document_id ?? policy!.source_document_id,
      version: policy!.version + 1,
    } as never)
    .eq("id", policyId)
    .eq("version", policy!.version);

  await admin
    .from("protection_extractions")
    .update({
      adviser_review_status: toState,
      reviewed_by_user_id: input.authUserId,
      reviewed_at: new Date().toISOString(),
      resulting_policy_id: policyId,
      resulting_version_id: versionRow.id,
      version: row.version + 1,
    } as never)
    .eq("id", row.id)
    .eq("version", row.version);

  await recordProtectionEvent({
    clientId: row.client_id,
    adviserUserId: row.adviser_user_id,
    eventType: toState === "corrected" ? "extraction_corrected" : "version_confirmed",
    entityType: "version",
    entityId: String(versionRow.id),
    actorUserId: input.authUserId,
    actorRole: "adviser",
    safeMetadata: { policyId, extractionId: row.id },
    requestId: input.requestId,
  });

  return { ok: true, data: { policyId: policyId!, versionId: String(versionRow.id) } };
}

export async function rejectProtectionExtraction(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  extractionId: string;
  expectedVersion: number;
  rejectionReason: string;
  requestId?: string;
}): Promise<CrmProtectionResult<{ extractionId: string }>> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("protection_extractions")
    .select("*")
    .eq("id", input.extractionId)
    .maybeSingle();
  const row = data as ExtractionRow | null;
  if (!row) return { ok: false, reason: "not_found" };

  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    row.client_id,
  );
  if (access.status !== "ok") {
    return { ok: false, reason: access.status === "forbidden" ? "forbidden" : "not_found" };
  }
  if (row.version !== input.expectedVersion) {
    return { ok: false, reason: "conflict" };
  }

  const fromState = isValidVerificationState(row.adviser_review_status)
    ? row.adviser_review_status
    : "provisional";
  try {
    validateVerificationTransition({ fromState, toState: "rejected", actorRole: "adviser" });
  } catch {
    return { ok: false, reason: "validation" };
  }

  const { error } = await admin
    .from("protection_extractions")
    .update({
      adviser_review_status: "rejected",
      rejection_reason: sanitizeText(input.rejectionReason, 500),
      reviewed_by_user_id: input.authUserId,
      reviewed_at: new Date().toISOString(),
      version: row.version + 1,
    } as never)
    .eq("id", row.id)
    .eq("version", row.version);
  if (error) return { ok: false, reason: "validation" };

  await recordProtectionEvent({
    clientId: row.client_id,
    adviserUserId: row.adviser_user_id,
    eventType: "extraction_rejected",
    entityType: "extraction",
    entityId: row.id,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  return { ok: true, data: { extractionId: row.id } };
}

export async function getAdviserProtectionPolicyDetail(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  policyId: string;
}): Promise<CrmProtectionResult<AdviserProtectionPolicyDetailDto>> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("protection_policies")
    .select("*")
    .eq("id", input.policyId)
    .maybeSingle();
  const policy = data as PolicyRow | null;
  if (!policy) return { ok: false, reason: "not_found" };

  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    policy.client_id,
  );
  if (access.status !== "ok") {
    return { ok: false, reason: access.status === "forbidden" ? "forbidden" : "not_found" };
  }

  const version = policy.current_confirmed_version_id
    ? await loadVersionRow(policy.current_confirmed_version_id)
    : null;
  const docTitle = await loadDocumentTitle(policy.source_document_id);

  return {
    ok: true,
    data: {
      policyId: policy.id,
      relationshipId: policy.client_id,
      insurer: policy.insurer,
      displayName: policy.display_name,
      policyCategory: policy.policy_category as CrmProtectionPolicyCategory,
      policyCategoryLabel: policyCategoryLabel(policy.policy_category),
      policyOwner: policy.policy_owner,
      lifeAssured: policy.life_assured,
      policyStatus: policy.policy_status as CrmProtectionPolicyStatus,
      policyStatusLabel: policyStatusLabel(policy.policy_status),
      policyRefMasked: policy.policy_ref_masked,
      policyStartDate: policy.policy_start_date,
      maturityOrExpiryDate: policy.maturity_or_expiry_date,
      sourceDocumentId: policy.source_document_id,
      sourceDocumentTitle: docTitle,
      sourceDocumentAvailable: Boolean(policy.source_document_id),
      currentConfirmedVersion: version ? mapVersionDto(version) : null,
      version: policy.version,
    },
  };
}

export async function listAdviserProtectionPolicyVersions(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  policyId: string;
}): Promise<CrmProtectionResult<{ versions: AdviserProtectionVersionDto[]; bounded: boolean }>> {
  const detail = await getAdviserProtectionPolicyDetail(input);
  if (!detail.ok) return detail;

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("protection_policy_versions")
    .select("*")
    .eq("policy_id", input.policyId)
    .order("version_number", { ascending: false })
    .limit(CRM_V2_PROTECTION_MAX_VERSIONS + 1);
  const rows = (data as VersionRow[] | null) ?? [];
  return {
    ok: true,
    data: {
      versions: rows.slice(0, CRM_V2_PROTECTION_MAX_VERSIONS).map(mapVersionDto),
      bounded: rows.length > CRM_V2_PROTECTION_MAX_VERSIONS,
    },
  };
}

export async function loadClientProtectionPortfolio(input: {
  clientId: string;
}): Promise<ClientProtectionPortfolioDto> {
  const policies = await loadPoliciesForClient(input.clientId);
  const policyRows = policies.slice(0, CRM_V2_PROTECTION_MAX_POLICIES);
  const versionIds = policyRows
    .map((p) => p.current_confirmed_version_id)
    .filter((id): id is string => Boolean(id));

  const versionsById = new Map<string, VersionRow>();
  if (versionIds.length > 0) {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("protection_policy_versions")
      .select("*")
      .in("id", versionIds)
      .in("verification_state", ["confirmed", "corrected"]);
    for (const row of (data as VersionRow[] | null) ?? []) {
      versionsById.set(row.id, row);
    }
  }

  const summaries: ClientProtectionPolicySummaryDto[] = [];
  let lastPortfolioVerifiedAt: string | null = null;

  for (const policy of policyRows) {
    const version = policy.current_confirmed_version_id
      ? versionsById.get(policy.current_confirmed_version_id)
      : null;
    if (!version) continue;
    if (version.confirmed_at && (!lastPortfolioVerifiedAt || version.confirmed_at > lastPortfolioVerifiedAt)) {
      lastPortfolioVerifiedAt = version.confirmed_at;
    }
    const components = parseCoverageComponents(version.coverage_components);
    summaries.push({
      policyId: policy.id,
      insurer: policy.insurer,
      displayName: policy.display_name,
      policyCategoryLabel: policyCategoryLabel(policy.policy_category),
      policyOwner: policy.policy_owner,
      lifeAssured: policy.life_assured,
      policyStatusLabel: policyStatusLabel(policy.policy_status),
      coverageSummary: buildCoverageSummary(components),
      premium: version.premium,
      premiumFrequencyLabel: premiumFrequencyLabel(version.premium_frequency),
      lastVerifiedAt: version.confirmed_at,
      sourceDocumentAvailable: Boolean(policy.source_document_id),
      detailHref: `/protection/${policy.id}`,
    });
  }

  return {
    policies: summaries,
    lastPortfolioVerifiedAt,
    bounded: policies.length > CRM_V2_PROTECTION_MAX_POLICIES,
  };
}

export async function getClientProtectionPolicyDetail(input: {
  clientId: string;
  policyId: string;
}): Promise<CrmProtectionResult<ClientProtectionPolicyDetailDto>> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("protection_policies")
    .select("*")
    .eq("id", input.policyId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  const policy = data as PolicyRow | null;
  if (!policy) return { ok: false, reason: "not_found" };

  const version = policy.current_confirmed_version_id
    ? await loadVersionRow(policy.current_confirmed_version_id)
    : null;
  if (!version || !isPortfolioEligibleState(version.verification_state as CrmProtectionVerificationState)) {
    return { ok: false, reason: "not_found" };
  }

  const components = parseCoverageComponents(version.coverage_components);
  return {
    ok: true,
    data: {
      policyId: policy.id,
      insurer: policy.insurer,
      displayName: policy.display_name,
      policyCategoryLabel: policyCategoryLabel(policy.policy_category),
      policyOwner: policy.policy_owner,
      lifeAssured: policy.life_assured,
      policyStatusLabel: policyStatusLabel(policy.policy_status),
      coverageComponents: components.map((c) => ({
        categoryLabel: c.categoryLabel,
        amountLabel: c.amount != null ? `${c.currency} ${c.amount.toLocaleString()}` : "On file",
        durationLabel: c.durationLabel,
      })),
      premium: version.premium,
      premiumFrequencyLabel: premiumFrequencyLabel(version.premium_frequency),
      policyTerm: version.policy_term,
      lastVerifiedAt: version.confirmed_at,
      sourceDocumentAvailable: Boolean(policy.source_document_id),
      correctionRequestHref: `/protection/${policy.id}?action=correction`,
    },
  };
}

export async function createClientProtectionCorrectionRequest(input: {
  clientId: string;
  authUserId: string;
  adviserUserId: string;
  policyId: string;
  category: CrmProtectionCorrectionCategory;
  explanation: string;
  supportingDocumentId?: string | null;
  idempotencyKey: string;
  requestTraceId?: string;
}): Promise<CrmProtectionResult<{ requestId: string }>> {
  const policyResult = await getClientProtectionPolicyDetail({
    clientId: input.clientId,
    policyId: input.policyId,
  });
  if (!policyResult.ok) return policyResult;

  const summary = `Protection correction — ${policyResult.data.displayName}`;
  const details = sanitizeText(input.explanation, 2000);
  const result = await createClientServiceRequest({
    authUserId: input.authUserId,
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    category: "protection_correction",
    summary: sanitizeText(summary, 200),
    details: `Category: ${input.category}. ${details}${
      input.supportingDocumentId ? ` Document: ${input.supportingDocumentId}` : ""
    }`,
    urgency: "normal",
    idempotencyKey: input.idempotencyKey,
    requestTraceId: input.requestTraceId,
    now: new Date().toISOString(),
  });

  if (!result.ok) return result;
  return { ok: true, data: { requestId: result.data.requestId } };
}

export async function createClientProtectionReviewRequest(input: {
  clientId: string;
  authUserId: string;
  adviserUserId: string;
  explanation: string;
  idempotencyKey: string;
  requestTraceId?: string;
}): Promise<CrmProtectionResult<{ requestId: string }>> {
  const result = await createClientServiceRequest({
    authUserId: input.authUserId,
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    category: "protection_review",
    summary: "Protection portfolio review requested",
    details: sanitizeText(input.explanation, 2000),
    urgency: "normal",
    idempotencyKey: input.idempotencyKey,
    requestTraceId: input.requestTraceId,
    now: new Date().toISOString(),
  });
  if (!result.ok) return result;
  return { ok: true, data: { requestId: result.data.requestId } };
}

export async function loadProtectionAppointmentPreparation(
  clientId: string,
): Promise<CrmProtectionAppointmentPreparationDto> {
  const [policies, extractions] = await Promise.all([
    loadPoliciesForClient(clientId),
    loadExtractionsForClient(clientId),
  ]);

  const admin = createAdminSupabaseClient();
  const { count: correctionCount } = await admin
    .from("client_service_requests")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("request_category", ["protection_correction", "protection_review"])
    .in("lifecycle_status", ["submitted", "acknowledged", "in_progress", "waiting_on_client"]);

  const { count: reportCount } = await admin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .contains("tags", ["protection_portfolio_summary"]);

  let lastVerified: string | null = null;
  let upcomingExpiry = 0;
  let missingSource = 0;
  for (const policy of policies) {
    if (!policy.source_document_id) missingSource += 1;
    if (policy.maturity_or_expiry_date) {
      const expiry = new Date(policy.maturity_or_expiry_date);
      const horizon = Date.now() + 90 * 24 * 60 * 60 * 1000;
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() <= horizon) upcomingExpiry += 1;
    }
    if (policy.current_confirmed_version_id) {
      const version = await loadVersionRow(policy.current_confirmed_version_id);
      if (version?.confirmed_at && (!lastVerified || version.confirmed_at > lastVerified)) {
        lastVerified = version.confirmed_at;
      }
    }
  }

  return {
    protectionReviewRequested: (correctionCount ?? 0) > 0,
    portfolioLastVerifiedAt: lastVerified,
    provisionalExtractionsAwaitingReview: extractions.filter((e) =>
      ["provisional", "awaiting_review"].includes(e.adviser_review_status),
    ).length,
    missingSourceDocuments: missingSource,
    clientCorrectionRequests: correctionCount ?? 0,
    upcomingPolicyExpiryOrMaturity: upcomingExpiry,
    protectionReportAvailable: (reportCount ?? 0) > 0,
  };
}
