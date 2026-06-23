import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/supabase/auditLog";

import { emitLifecycleNotificationSafe } from "@/lib/communications/lifecycleNotificationService";

const REVIEW_SUBMISSION_PREFIX = "client_review_submission:";

export async function completeClientReviewSubmission(input: {
  submissionId: string;
  clientId: string;
  actorUserId: string;
}): Promise<{ ok: true; alreadyReviewed: boolean } | { ok: false; reason: string }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("client_review_submissions")
    .select("id, client_id, status")
    .eq("id", input.submissionId)
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "submission_not_found" };
  }

  const row = data as { id: string; client_id: string; status: string };
  if (row.status === "reviewed") {
    return { ok: true, alreadyReviewed: true };
  }

  const reviewedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("client_review_submissions")
    .update({
      status: "reviewed",
      reviewed_at: reviewedAt,
    } as never)
    .eq("id", input.submissionId)
    .eq("client_id", input.clientId);

  if (updateError) {
    return { ok: false, reason: "update_failed" };
  }

  await emitLifecycleNotificationSafe({
    event: "action_completed",
    sourceEntityType: "client_review_submission",
    sourceEntityId: input.submissionId,
    sourceLifecycleVersion: "reviewed",
    recipientClientId: input.clientId,
    referenceId: input.submissionId,
    actorUserId: input.actorUserId,
    isClientVisible: true,
  });

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.actorUserId,
    action: "review_submission_completed",
    entityType: "client_review_submissions",
    entityId: input.submissionId,
  });

  return { ok: true, alreadyReviewed: false };
}

export async function requestClientReviewAction(input: {
  submissionId: string;
  clientId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("client_review_submissions")
    .select("id, client_id, status")
    .eq("id", input.submissionId)
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "submission_not_found" };
  }

  const transitionAt = new Date().toISOString();

  await emitLifecycleNotificationSafe({
    event: "action_required",
    sourceEntityType: "client_review_submission",
    sourceEntityId: input.submissionId,
    sourceLifecycleVersion: transitionAt,
    recipientClientId: input.clientId,
    referenceId: input.submissionId,
    actorUserId: input.actorUserId,
    isClientVisible: true,
  });

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.actorUserId,
    action: "review_action_required",
    entityType: "client_review_submissions",
    entityId: input.submissionId,
  });

  return { ok: true };
}

/** Parse adviser task source_key and complete linked review submission. */
export async function syncReviewSubmissionOnTaskComplete(input: {
  sourceKey: string | null;
  clientId: string | null;
  actorUserId: string;
}): Promise<void> {
  if (!input.sourceKey || !input.clientId) {
    return;
  }

  if (!input.sourceKey.startsWith(REVIEW_SUBMISSION_PREFIX)) {
    return;
  }

  const parts = input.sourceKey.split(":");
  const submissionId = parts[parts.length - 1];
  if (!submissionId) {
    return;
  }

  await completeClientReviewSubmission({
    submissionId,
    clientId: input.clientId,
    actorUserId: input.actorUserId,
  }).catch(() => undefined);
}
