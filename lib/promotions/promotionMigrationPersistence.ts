import "server-only";

import type { PromotionMigrationClassification } from "@/lib/communications/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import {
  parseAtomicMigrationRpcResult,
  type AtomicMigrationRpcResult,
  type PromotionMigrationOutcome,
} from "./promotionMigrationIdempotency";

export type ExecuteAtomicPromotionMigrationInput = {
  promotionId: string;
  classification: PromotionMigrationClassification;
  reviewerUserId: string;
  operatorNote?: string | null;
  title: string;
  summary: string;
  body: string;
  category: string;
  contentType: string;
  audienceScope: string;
  externalUrl: string | null;
  expiresAt: string | null;
  adviserUserId: string | null;
};

export type ExecuteAtomicPromotionMigrationResult =
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

export async function executeAtomicLegacyPromotionMigration(
  input: ExecuteAtomicPromotionMigrationInput,
): Promise<ExecuteAtomicPromotionMigrationResult> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin.rpc("execute_legacy_promotion_migration", {
    p_promotion_id: input.promotionId,
    p_classification: input.classification,
    p_reviewer_user_id: input.reviewerUserId,
    p_notes: input.operatorNote ?? null,
    p_title: input.title,
    p_summary: input.summary,
    p_body: input.body,
    p_category: input.category,
    p_content_type: input.contentType,
    p_audience_scope: input.audienceScope,
    p_external_url: input.externalUrl,
    p_expires_at: input.expiresAt,
    p_adviser_user_id: input.adviserUserId,
  } as never);

  if (error) {
    return { ok: false, outcome: "failed", reason: "rpc_error" };
  }

  const parsed = parseAtomicMigrationRpcResult(data);
  if (!parsed) {
    return { ok: false, outcome: "failed", reason: "invalid_rpc_response" };
  }

  return mapAtomicMigrationResult(parsed);
}

function mapAtomicMigrationResult(
  parsed: AtomicMigrationRpcResult,
): ExecuteAtomicPromotionMigrationResult {
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
