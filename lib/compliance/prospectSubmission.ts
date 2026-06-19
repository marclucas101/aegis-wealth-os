import "server-only";

import type { DiscoverCompleteness } from "@/src/lib/scoring/types";
import { computeCompleteness, type DiscoverFormData } from "@/lib/aegis/localProfile";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dbUpdateClientRelationshipStage } from "@/lib/supabase/compliancePublication";
import type { AppClientRow } from "@/lib/supabase/userProfile";

import { safeRecordProspectEvent } from "./prospectAnalytics";
import type { RelationshipStage } from "./types";

const REVIEW_TASK_SOURCE_PREFIX = "prospect_fact_find_review:";

export type ProspectSubmissionResult = {
  ok: true;
  alreadySubmitted: boolean;
  stage: RelationshipStage;
  taskCreated: boolean;
};

export type ProspectSubmissionError = {
  ok: false;
  reason: "validation_failed" | "missing_profile" | "privacy_required";
  message: string;
  missingSections?: string[];
};

const REQUIRED_COMPLETENESS_KEYS: Array<{
  key: keyof DiscoverCompleteness;
  label: string;
  minimum: number;
}> = [
  { key: "personalInfo", label: "Personal details", minimum: 60 },
  { key: "income", label: "Income overview", minimum: 40 },
  { key: "expenses", label: "Monthly commitments", minimum: 30 },
];

export function computeServerSubmissionCompleteness(
  formData: DiscoverFormData,
): DiscoverCompleteness {
  return computeCompleteness(formData);
}

function validateSubmissionCompleteness(
  completeness: DiscoverCompleteness,
): string[] {
  const missing: string[] = [];
  for (const rule of REQUIRED_COMPLETENESS_KEYS) {
    if ((completeness[rule.key] ?? 0) < rule.minimum) {
      missing.push(rule.label);
    }
  }
  return missing;
}

async function findExistingReviewTask(clientId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const sourceKey = `${REVIEW_TASK_SOURCE_PREFIX}${clientId}`;

  const { data, error } = await admin
    .from("advisor_tasks")
    .select("id")
    .eq("source_key", sourceKey)
    .in("status", ["open", "in_progress"])
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check review task: ${error.message}`);
  }

  return Boolean(data);
}

async function createProspectReviewTask(input: {
  clientId: string;
  adviserUserId: string;
  clientDisplayName: string;
  actorUserId: string;
}): Promise<boolean> {
  const sourceKey = `${REVIEW_TASK_SOURCE_PREFIX}${input.clientId}`;
  const exists = await findExistingReviewTask(input.clientId);
  if (exists) {
    return false;
  }

  const admin = createAdminSupabaseClient();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  const { error } = await admin.from("advisor_tasks").insert({
    client_id: input.clientId,
    assigned_to_user_id: input.adviserUserId,
    created_by_user_id: input.actorUserId,
    title: `Review prospect profile — ${input.clientDisplayName}`,
    description:
      "A prospect has submitted their financial profile for adviser review. " +
      "Review completeness, internal analysis, and prepare for the advisory meeting.",
    task_type: "review",
    priority: "high",
    status: "open",
    due_date: dueDateStr,
    related_entity_type: "discover_profiles",
    related_entity_id: null,
    source_key: sourceKey,
  } as never);

  if (error) {
    if (error.code === "23505") {
      return false;
    }
    throw new Error(`Failed to create adviser review task: ${error.message}`);
  }

  return true;
}

export async function submitProspectProfile(input: {
  client: AppClientRow;
  actorUserId: string;
  formData: DiscoverFormData;
  hasDiscoverData: boolean;
  privacyAcknowledged: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<ProspectSubmissionResult | ProspectSubmissionError> {
  if (!input.privacyAcknowledged) {
    return {
      ok: false,
      reason: "privacy_required",
      message: "Privacy acknowledgement is required before submission.",
    };
  }

  if (!input.hasDiscoverData) {
    return {
      ok: false,
      reason: "missing_profile",
      message: "Please save your profile before submitting.",
    };
  }

  const completeness = computeServerSubmissionCompleteness(input.formData);
  const missingSections = validateSubmissionCompleteness(completeness);
  if (missingSections.length > 0) {
    return {
      ok: false,
      reason: "validation_failed",
      message: "Please complete required sections before submitting.",
      missingSections,
    };
  }

  const currentStage = input.client.relationship_stage;
  const alreadySubmitted = currentStage !== "prospect";

  let taskCreated = false;
  let resultingStage = currentStage;

  if (currentStage === "prospect") {
    await dbUpdateClientRelationshipStage(input.client.id, "fact_find_complete");
    resultingStage = "fact_find_complete";
    await writeAuditLog({
      clientId: input.client.id,
      userId: input.actorUserId,
      action: "relationship_stage_changed",
      entityType: "client",
      entityId: input.client.id,
      metadata: {
        oldStage: currentStage,
        newStage: "fact_find_complete",
        actorRole: "client",
        trigger: "prospect_profile_submitted",
        privacyAcknowledged: true,
      },
    });
  }

  if (input.client.advisor_user_id && currentStage === "prospect") {
    taskCreated = await createProspectReviewTask({
      clientId: input.client.id,
      adviserUserId: input.client.advisor_user_id,
      clientDisplayName: input.client.display_name,
      actorUserId: input.actorUserId,
    });
  }

  await safeRecordProspectEvent({
    clientId: input.client.id,
    userId: input.actorUserId,
    event: alreadySubmitted
      ? "prospect_profile_resumed"
      : "prospect_profile_submitted",
    metadata: {
      alreadySubmitted,
      taskCreated,
      stage: resultingStage,
      privacyAcknowledged: true,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    ok: true,
    alreadySubmitted,
    stage: resultingStage,
    taskCreated,
  };
}
