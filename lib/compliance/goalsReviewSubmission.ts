import "server-only";

import { writeAuditLog } from "@/lib/supabase/auditLog";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppClientRow } from "@/lib/supabase/userProfile";

const REVIEW_SUBMISSION_PREFIX = "client_review_submission:";

export type ReviewSubmissionType = "annual_review" | "life_change" | "goals_update";

export type ReviewSubmissionResult = {
  ok: true;
  alreadySubmitted: boolean;
  submissionId: string;
  taskCreated: boolean;
};

export async function submitClientReviewInformation(input: {
  client: AppClientRow;
  actorUserId: string;
  submissionType: ReviewSubmissionType;
  payload: Record<string, unknown>;
}): Promise<ReviewSubmissionResult> {
  const admin = createAdminSupabaseClient();
  const sourceKey = `${REVIEW_SUBMISSION_PREFIX}${input.client.id}:${input.submissionType}`;

  const { data: existing } = await admin
    .from("client_review_submissions")
    .select("id, status")
    .eq("source_key", sourceKey)
    .eq("status", "pending_review")
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      alreadySubmitted: true,
      submissionId: (existing as { id: string }).id,
      taskCreated: false,
    };
  }

  const { data: inserted, error } = await admin
    .from("client_review_submissions")
    .insert({
      client_id: input.client.id,
      submission_type: input.submissionType,
      payload: input.payload,
      status: "pending_review",
      source_key: sourceKey,
      submitted_by_user_id: input.actorUserId,
    } as never)
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to submit review information: ${error?.message ?? "unknown"}`);
  }

  const submissionId = (inserted as { id: string }).id;
  const taskCreated = await createAdviserReviewTask({
    clientId: input.client.id,
    adviserUserId: input.client.advisor_user_id,
    clientDisplayName: input.client.display_name ?? "Client",
    actorUserId: input.actorUserId,
    submissionType: input.submissionType,
    sourceKey: `${sourceKey}:${submissionId}`,
  });

  await writeAuditLog({
    clientId: input.client.id,
    userId: input.actorUserId,
    action: "review_submitted",
    entityType: "client_review_submissions",
    entityId: submissionId,
    metadata: {
      submissionType: input.submissionType,
      taskCreated,
    },
  });

  return {
    ok: true,
    alreadySubmitted: false,
    submissionId,
    taskCreated,
  };
}

async function createAdviserReviewTask(input: {
  clientId: string;
  adviserUserId: string | null;
  clientDisplayName: string;
  actorUserId: string;
  submissionType: ReviewSubmissionType;
  sourceKey: string;
}): Promise<boolean> {
  if (!input.adviserUserId) {
    return false;
  }

  const admin = createAdminSupabaseClient();

  const { data: existingTask } = await admin
    .from("advisor_tasks")
    .select("id")
    .eq("source_key", input.sourceKey)
    .in("status", ["open", "in_progress"])
    .maybeSingle();

  if (existingTask) {
    return false;
  }

  const labels: Record<ReviewSubmissionType, string> = {
    annual_review: "Review annual review information",
    life_change: "Review life change update",
    goals_update: "Review goals update",
  };

  const { error } = await admin.from("advisor_tasks").insert({
    client_id: input.clientId,
    assigned_to_user_id: input.adviserUserId,
    created_by_user_id: input.actorUserId,
    title: `${labels[input.submissionType]} — ${input.clientDisplayName}`,
    description: "Client submitted information for adviser review.",
    task_type: "review",
    priority: "medium",
    status: "open",
    source_key: input.sourceKey,
  } as never);

  if (error) {
    throw new Error(`Failed to create adviser review task: ${error.message}`);
  }

  return true;
}

export async function loadLatestReviewSubmissionStatus(
  clientId: string,
): Promise<{ pending: boolean; submissionType: ReviewSubmissionType | null }> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("client_review_submissions")
    .select("submission_type, status")
    .eq("client_id", clientId)
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { pending: false, submissionType: null };
  }

  const row = data as { submission_type: ReviewSubmissionType; status: string };
  return { pending: true, submissionType: row.submission_type };
}
