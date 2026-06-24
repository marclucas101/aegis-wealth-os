/**
 * Phase 9F.4 local/staging-only promotion migration acceptance harness.
 * No server-only guard — imported by scripts only. Never auto-run in CI/deploy.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  legacyPromotionMigrationDestinationId,
  parseAtomicMigrationRpcResult,
  type PromotionMigrationOutcome,
} from "./promotionMigrationIdempotency";

/** Embedded in title, summary, and details — required for cleanup verification. */
export const PHASE9F4_FIXTURE_MARKER = "PHASE9F4_DISPOSABLE_TEST_FIXTURE";

export const PHASE9F4_FIXTURE_TITLE =
  "[PHASE9F4 DISPOSABLE] Local migration idempotency acceptance fixture";

export const PHASE9F4_FIXTURE_SUMMARY =
  "Disposable Phase 9F.4 test promotion. Safe to delete after local acceptance. Not client-specific.";

/** Stable promotion id for repeatable local fixture upserts. */
export const PHASE9F4_FIXTURE_PROMOTION_ID = "9f409f40-9f40-4f40-8f40-9f409f400012";

export const PHASE9F4_FIXTURE_CLASSIFICATION = "safe_educational" as const;

export const PHASE9F4_FIXTURE_STATE_RELATIVE_PATH =
  "scripts/.phase9f4-migration-fixture-state.json";

export type Phase9f4FixtureState = {
  marker: typeof PHASE9F4_FIXTURE_MARKER;
  promotionId: string;
  destinationId: string;
  createdAt: string;
};

export type Phase9f4HarnessEnv = {
  url: string;
  host: string;
  projectRef: string | null;
  classification: "local" | "allowlisted_staging" | "blocked";
};

export type AtomicMigrationHarnessResult =
  | {
      ok: true;
      outcome: PromotionMigrationOutcome;
      contentId: string | null;
      skipped: boolean;
      reused: boolean;
    }
  | {
      ok: false;
      outcome: PromotionMigrationOutcome;
      reason: string;
      contentId?: string | null;
    };

export function fixtureStatePath(root = process.cwd()): string {
  return resolve(root, PHASE9F4_FIXTURE_STATE_RELATIVE_PATH);
}

export function readAllowlistedStagingProjectRefs(): string[] {
  const raw = process.env.PHASE9F4_MIGRATION_FIXTURE_ALLOWED_PROJECT_REFS?.trim() ?? "";
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function extractSupabaseProjectRef(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(parsed.hostname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function isLocalSupabaseHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function classifySupabaseHarnessTarget(url: string): Phase9f4HarnessEnv {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      url,
      host: "(invalid)",
      projectRef: null,
      classification: "blocked",
    };
  }

  const projectRef = extractSupabaseProjectRef(url);
  const allowlist = readAllowlistedStagingProjectRefs();

  if (isLocalSupabaseHost(parsed.hostname)) {
    return {
      url,
      host: parsed.host,
      projectRef,
      classification: "local",
    };
  }

  if (projectRef && allowlist.includes(projectRef)) {
    return {
      url,
      host: parsed.host,
      projectRef,
      classification: "allowlisted_staging",
    };
  }

  return {
    url,
    host: parsed.host,
    projectRef,
    classification: "blocked",
  };
}

export function assertPhase9f4HarnessTargetAllowed(url: string): Phase9f4HarnessEnv {
  const env = classifySupabaseHarnessTarget(url);

  if (env.classification === "blocked") {
    const allowlist = readAllowlistedStagingProjectRefs();
    const hint =
      allowlist.length > 0
        ? `Set PHASE9F4_MIGRATION_FIXTURE_ALLOWED_PROJECT_REFS to an approved staging ref (current: ${allowlist.join(", ")}).`
        : "Use localhost/127.0.0.1 Supabase or set PHASE9F4_MIGRATION_FIXTURE_ALLOWED_PROJECT_REFS for approved staging.";

    throw new Error(
      `Refusing Phase 9F.4 migration fixture on non-local Supabase host "${env.host}"${env.projectRef ? ` (project ${env.projectRef})` : ""}. ${hint}`,
    );
  }

  return env;
}

export function buildFixtureDetailsJson(): string {
  return JSON.stringify({
    fixture_marker: PHASE9F4_FIXTURE_MARKER,
    highlights: ["Disposable local acceptance fixture only"],
    eligibility: "Not for production or client distribution",
  });
}

export function fixtureTitleHasMarker(title: string | null | undefined): boolean {
  return Boolean(title?.includes(PHASE9F4_FIXTURE_MARKER) || title === PHASE9F4_FIXTURE_TITLE);
}

export function fixtureSummaryHasMarker(summary: string | null | undefined): boolean {
  return Boolean(summary?.includes(PHASE9F4_FIXTURE_MARKER));
}

export function fixtureDetailsHasMarker(details: string | null | undefined): boolean {
  if (!details?.includes(PHASE9F4_FIXTURE_MARKER)) {
    return false;
  }
  try {
    const parsed = JSON.parse(details) as { fixture_marker?: unknown };
    return parsed.fixture_marker === PHASE9F4_FIXTURE_MARKER;
  } catch {
    return false;
  }
}

export function assertFixturePromotionRow(row: {
  id: string;
  title: string | null;
  summary: string | null;
  details: string | null;
}): void {
  if (row.id !== PHASE9F4_FIXTURE_PROMOTION_ID) {
    throw new Error(`Fixture promotion id mismatch (expected ${PHASE9F4_FIXTURE_PROMOTION_ID}).`);
  }
  if (!fixtureTitleHasMarker(row.title)) {
    throw new Error("Fixture marker missing from promotion title — refusing destructive action.");
  }
  if (!fixtureSummaryHasMarker(row.summary)) {
    throw new Error("Fixture marker missing from promotion summary — refusing destructive action.");
  }
  if (!fixtureDetailsHasMarker(row.details)) {
    throw new Error("Fixture marker missing from promotion details — refusing destructive action.");
  }
}

export function buildFixtureMigrationRpcPayload(input: {
  promotionId: string;
  reviewerUserId: string;
}) {
  return {
    p_promotion_id: input.promotionId,
    p_classification: PHASE9F4_FIXTURE_CLASSIFICATION,
    p_reviewer_user_id: input.reviewerUserId,
    p_notes: "Phase 9F.4 local acceptance harness",
    p_title: PHASE9F4_FIXTURE_TITLE,
    p_summary: PHASE9F4_FIXTURE_SUMMARY,
    p_body: "• Disposable local acceptance fixture only",
    p_category: "financial_education",
    p_content_type: "general_education",
    p_audience_scope: "all_active_clients",
    p_external_url: null,
    p_expires_at: null,
    p_adviser_user_id: null,
  };
}

export async function assertLegacyPromotionsWriteDisabled(
  admin: SupabaseClient,
): Promise<void> {
  const { data, error } = await admin
    .from("platform_feature_controls")
    .select("enabled")
    .eq("feature_key", "legacy_promotions_write")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read legacy_promotions_write feature control: ${error.message}`);
  }

  if (data?.enabled === true) {
    throw new Error(
      "legacy_promotions_write is enabled — refusing harness run. Never enable this in production.",
    );
  }
}

export async function assertMigrationRpcAvailable(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.rpc("execute_legacy_promotion_migration", {
    p_promotion_id: "00000000-0000-4000-8000-000000000000",
    p_classification: "safe_educational",
    p_reviewer_user_id: "00000000-0000-4000-8000-000000000001",
    p_notes: null,
    p_title: "probe",
    p_summary: "probe",
    p_body: "probe",
    p_category: "financial_education",
    p_content_type: "general_education",
    p_audience_scope: "all_active_clients",
    p_external_url: null,
    p_expires_at: null,
    p_adviser_user_id: null,
  } as never);

  if (error?.message?.includes("does not exist")) {
    throw new Error(
      "execute_legacy_promotion_migration RPC is unavailable — apply migration 202606200012 before running acceptance.",
    );
  }
}

export async function resolveHarnessReviewerUserId(
  admin: SupabaseClient,
): Promise<string> {
  const { data, error } = await admin
    .from("users")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve admin reviewer user: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(
      "No admin user found for migration reviewer. Run `npm run demo:seed` on local/staging first.",
    );
  }

  return data.id;
}

export async function upsertPhase9f4FixturePromotion(
  admin: SupabaseClient,
): Promise<Phase9f4FixtureState> {
  const destinationId = legacyPromotionMigrationDestinationId(PHASE9F4_FIXTURE_PROMOTION_ID);

  const row = {
    id: PHASE9F4_FIXTURE_PROMOTION_ID,
    title: PHASE9F4_FIXTURE_TITLE,
    summary: PHASE9F4_FIXTURE_SUMMARY,
    category: "Education",
    audience: "all_users",
    status: "draft",
    priority: 0,
    details: buildFixtureDetailsJson(),
    subtitle: null,
    cta_label: null,
    cta_url: null,
    image_url: null,
    attachment_url: null,
    starts_at: null,
    ends_at: null,
    created_by: null,
  };

  const { error } = await admin.from("promotions").upsert(row as never, { onConflict: "id" });
  if (error) {
    throw new Error(`Failed to upsert fixture promotion: ${error.message}`);
  }

  const state: Phase9f4FixtureState = {
    marker: PHASE9F4_FIXTURE_MARKER,
    promotionId: PHASE9F4_FIXTURE_PROMOTION_ID,
    destinationId,
    createdAt: new Date().toISOString(),
  };

  writeFixtureState(state);
  return state;
}

export function writeFixtureState(state: Phase9f4FixtureState, root = process.cwd()): void {
  const path = fixtureStatePath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function readFixtureState(root = process.cwd()): Phase9f4FixtureState | null {
  const path = fixtureStatePath(root);
  if (!existsSync(path)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as Phase9f4FixtureState;
  if (
    parsed.marker !== PHASE9F4_FIXTURE_MARKER ||
    parsed.promotionId !== PHASE9F4_FIXTURE_PROMOTION_ID
  ) {
    throw new Error("Invalid Phase 9F.4 fixture state file — delete scripts/.phase9f4-migration-fixture-state.json and recreate.");
  }

  return parsed;
}

export async function loadFixturePromotionSnapshot(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("promotions")
    .select(
      "id, title, summary, details, category, audience, status, priority, image_url, attachment_url, created_by, created_at, updated_at",
    )
    .eq("id", PHASE9F4_FIXTURE_PROMOTION_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load fixture promotion: ${error.message}`);
  }

  if (!data) {
    throw new Error("Fixture promotion not found — run fixture create first.");
  }

  assertFixturePromotionRow(data as never);
  return data;
}

export async function invokeFixtureMigrationRpc(
  admin: SupabaseClient,
  reviewerUserId: string,
): Promise<AtomicMigrationHarnessResult> {
  const { data, error } = await admin.rpc(
    "execute_legacy_promotion_migration",
    buildFixtureMigrationRpcPayload({
      promotionId: PHASE9F4_FIXTURE_PROMOTION_ID,
      reviewerUserId,
    }) as never,
  );

  if (error) {
    return { ok: false, outcome: "failed", reason: error.message };
  }

  const parsed = parseAtomicMigrationRpcResult(data);
  if (!parsed) {
    return { ok: false, outcome: "failed", reason: "invalid_rpc_response" };
  }

  if (!parsed.ok) {
    return {
      ok: false,
      outcome: parsed.outcome,
      reason: parsed.reason ?? parsed.outcome,
      contentId: parsed.content_id ?? null,
    };
  }

  return {
    ok: true,
    outcome: parsed.outcome,
    contentId: parsed.content_id ?? null,
    skipped: parsed.skipped === true,
    reused: parsed.reused === true || parsed.outcome === "already_migrated",
  };
}

export async function cleanupPhase9f4Fixture(
  admin: SupabaseClient,
  options: { confirm: boolean },
): Promise<void> {
  if (!options.confirm) {
    throw new Error("Cleanup requires explicit --confirm.");
  }

  const state = readFixtureState();
  const promotion = await loadFixturePromotionSnapshot(admin);
  const destinationId =
    state?.destinationId ?? legacyPromotionMigrationDestinationId(PHASE9F4_FIXTURE_PROMOTION_ID);

  if (destinationId !== legacyPromotionMigrationDestinationId(PHASE9F4_FIXTURE_PROMOTION_ID)) {
    throw new Error("Fixture destination id mismatch — refusing cleanup.");
  }

  const { data: governed, error: governedLoadError } = await admin
    .from("governed_content")
    .select("id, title, external_source_name, approval_status")
    .eq("id", destinationId)
    .maybeSingle();

  if (governedLoadError) {
    throw new Error(`Failed to inspect governed draft: ${governedLoadError.message}`);
  }

  if (governed) {
    if (governed.external_source_name !== "legacy_promotion") {
      throw new Error(
        "Governed draft external_source_name is not legacy_promotion — refusing cleanup.",
      );
    }
    if (!governed.title?.includes("PHASE9F4 DISPOSABLE")) {
      throw new Error("Governed draft title missing disposable marker — refusing cleanup.");
    }

    const { error: reviewDeleteError } = await admin
      .from("promotion_migration_reviews")
      .delete()
      .eq("promotion_id", PHASE9F4_FIXTURE_PROMOTION_ID);

    if (reviewDeleteError) {
      throw new Error(`Failed to delete migration review linkage: ${reviewDeleteError.message}`);
    }

    const { error: governedDeleteError } = await admin
      .from("governed_content")
      .delete()
      .eq("id", destinationId);

    if (governedDeleteError) {
      throw new Error(`Failed to delete governed draft: ${governedDeleteError.message}`);
    }
  } else {
    await admin
      .from("promotion_migration_reviews")
      .delete()
      .eq("promotion_id", PHASE9F4_FIXTURE_PROMOTION_ID);
  }

  const { error: promotionDeleteError } = await admin
    .from("promotions")
    .delete()
    .eq("id", promotion.id);

  if (promotionDeleteError) {
    throw new Error(`Failed to delete fixture promotion: ${promotionDeleteError.message}`);
  }

  const path = fixtureStatePath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
