import "server-only";

import { writeAuditLog } from "@/lib/supabase/auditLog";
import { loadCurrentDiscoverProfile } from "@/lib/supabase/discoverPersistence";
import {
  dbInsertMeetingSessionEvent,
  dbUpdateMeetingSession,
  type MeetingSessionRow,
} from "@/lib/supabase/meetingSessionPersistence";
import type { AppClientRow } from "@/lib/supabase/userProfile";

import { sanitizeMeetingAuditMetadata } from "@/lib/compliance/meetingAuditMetadata";
import { IMMUTABLE_MEETING_STATUSES } from "@/lib/compliance/meetingSessionLifecycle";
import type {
  FactConfirmationRecord,
  FactConfirmationStatus,
} from "./meetingStudioTypes";

/** Canonical fact fields advisers may confirm during meetings. */
export const CONFIRMABLE_FACT_FIELDS: Record<
  string,
  { label: string; formPath: string[]; requiresRecalculation: boolean }
> = {
  household_size: {
    label: "Household size",
    formPath: ["family", "householdSize"],
    requiresRecalculation: true,
  },
  dependants: {
    label: "Dependants",
    formPath: ["family", "dependants"],
    requiresRecalculation: true,
  },
  annual_income: {
    label: "Annual income",
    formPath: ["income", "annualIncome"],
    requiresRecalculation: true,
  },
  monthly_expenses: {
    label: "Monthly expenses",
    formPath: ["expenses", "monthlyTotal"],
    requiresRecalculation: true,
  },
  total_assets: {
    label: "Total assets",
    formPath: ["assets", "totalValue"],
    requiresRecalculation: true,
  },
  total_liabilities: {
    label: "Total liabilities",
    formPath: ["liabilities", "totalValue"],
    requiresRecalculation: true,
  },
  insurance_arrangements: {
    label: "Insurance arrangements",
    formPath: ["policies", "summary"],
    requiresRecalculation: false,
  },
  primary_goal: {
    label: "Primary goal",
    formPath: ["business", "primaryGoal"],
    requiresRecalculation: false,
  },
  time_horizon: {
    label: "Time horizon",
    formPath: ["business", "timeHorizon"],
    requiresRecalculation: false,
  },
};

/** System fields that must never be corrected via meeting fact confirmation. */
export const PROHIBITED_FACT_FIELD_KEYS = [
  "relationship_stage",
  "advisor_user_id",
  "publication_status",
  "role",
  "client_id",
  "status",
] as const;

function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? null;
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]!] = value;
}

export async function loadConfirmableFacts(
  clientId: string,
): Promise<Array<{ fieldKey: string; label: string; currentValue: string | null }>> {
  const discover = await loadCurrentDiscoverProfile(clientId);
  const formData = (discover?.formData ?? {}) as Record<string, unknown>;

  return Object.entries(CONFIRMABLE_FACT_FIELDS).map(([fieldKey, meta]) => {
    const raw = getNestedValue(formData, meta.formPath);
    return {
      fieldKey,
      label: meta.label,
      currentValue: raw != null ? String(raw) : null,
    };
  });
}

export async function confirmMeetingFact(input: {
  session: MeetingSessionRow;
  client: AppClientRow;
  fieldKey: string;
  status: FactConfirmationStatus;
  correctedValue?: string | null;
  adviserUserId: string;
}): Promise<{
  session: MeetingSessionRow;
  requiresRecalculation: boolean;
}> {
  if (
    PROHIBITED_FACT_FIELD_KEYS.includes(
      input.fieldKey as (typeof PROHIBITED_FACT_FIELD_KEYS)[number],
    )
  ) {
    throw new Error("Prohibited fact field");
  }

  if (IMMUTABLE_MEETING_STATUSES.includes(input.session.status)) {
    throw new Error("Completed sessions cannot be modified");
  }

  const meta = CONFIRMABLE_FACT_FIELDS[input.fieldKey];
  if (!meta) {
    throw new Error("Unknown fact field");
  }

  const discover = await loadCurrentDiscoverProfile(input.client.id);
  if (!discover) {
    throw new Error("Client has no profile to confirm");
  }

  const formData = { ...(discover.formData as unknown as Record<string, unknown>) };
  const currentValue = getNestedValue(formData, meta.formPath);
  let requiresRecalculation = false;

  if (input.status === "corrected" && input.correctedValue != null) {
    const parsed = Number.isFinite(Number(input.correctedValue))
      ? Number(input.correctedValue)
      : input.correctedValue;
    setNestedValue(formData, meta.formPath, parsed);
    requiresRecalculation = meta.requiresRecalculation;

    const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("discover_profiles")
      .update({ form_data: formData as never } as never)
      .eq("id", discover.id);

    if (error) {
      throw new Error(`Failed to apply fact correction: ${error.message}`);
    }
  }

  const record: FactConfirmationRecord = {
    fieldKey: input.fieldKey,
    label: meta.label,
    currentValue: currentValue != null ? String(currentValue) : null,
    status: input.status,
    correctedValue: input.correctedValue ?? null,
    requiresRecalculation: requiresRecalculation || meta.requiresRecalculation,
    confirmedByUserId: input.adviserUserId,
    confirmedAt: new Date().toISOString(),
  };

  const existing = input.session.fact_confirmations.filter(
    (f) => f.fieldKey !== input.fieldKey,
  );
  const factConfirmations = [...existing, record];

  const session = await dbUpdateMeetingSession(
    input.session.id,
    input.session.client_id,
    {
      fact_confirmations: factConfirmations,
      requires_analysis_refresh:
        input.session.requires_analysis_refresh || requiresRecalculation,
    },
  );

  const eventType =
    input.status === "corrected" ? "fact_corrected" : "fact_confirmed";

  await dbInsertMeetingSessionEvent({
    session_id: session.id,
    client_id: session.client_id,
    adviser_user_id: input.adviserUserId,
    event_type: eventType,
    section_type: "facts_and_assumptions",
    metadata: sanitizeMeetingAuditMetadata({
      fieldKey: input.fieldKey,
      status: input.status,
      requiresRecalculation,
      algorithmVersion: session.algorithm_version,
    }),
  });

  await writeAuditLog({
    clientId: session.client_id,
    userId: input.adviserUserId,
    action: eventType,
    entityType: "meeting_session",
    entityId: session.id,
    metadata: sanitizeMeetingAuditMetadata({
      fieldKey: input.fieldKey,
      status: input.status,
      requiresRecalculation,
    }),
  });

  return { session, requiresRecalculation };
}
