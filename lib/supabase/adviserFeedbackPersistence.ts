import "server-only";

import {
  FEEDBACK_DISMISS_COOLDOWN_DAYS,
  FEEDBACK_STATUSES,
  TESTIMONIAL_DISPLAY_PREFERENCES,
  type AdviserFeedbackInput,
  type AdviserFeedbackRecord,
  type AdviserFeedbackSummary,
  type FeedbackPromptState,
  type FeedbackStatus,
  type TestimonialDisplayPreference,
} from "@/lib/aegis/adviserFeedback";

import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";
import { ensureUserClientProfile } from "./userProfile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ONBOARDING_COMPLETE_STATUSES = new Set(["active", "review_due"]);

type FeedbackRow = {
  id: string;
  client_user_id: string;
  client_id: string | null;
  adviser_user_id: string | null;
  rating_overall: number;
  rating_clarity: number | null;
  rating_responsiveness: number | null;
  rating_trust: number | null;
  rating_professionalism: number | null;
  feedback_text: string | null;
  what_went_well: string | null;
  what_could_improve: string | null;
  permission_to_use_as_testimonial: boolean;
  testimonial_display_name: string | null;
  testimonial_anonymous: boolean;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

type ClientFeedbackFields = AppClientRow & {
  feedback_prompted_at?: string | null;
  feedback_submitted_at?: string | null;
  feedback_prompt_dismissed_at?: string | null;
};

export {
  FEEDBACK_DISMISS_COOLDOWN_DAYS,
  FEEDBACK_STATUSES,
  TESTIMONIAL_DISPLAY_PREFERENCES,
  type AdviserFeedbackInput,
  type AdviserFeedbackRecord,
  type AdviserFeedbackSummary,
  type FeedbackPromptState,
  type FeedbackStatus,
  type TestimonialDisplayPreference,
};

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function mapStatus(value: string): FeedbackStatus {
  if ((FEEDBACK_STATUSES as readonly string[]).includes(value)) {
    return value as FeedbackStatus;
  }

  return "submitted";
}

function validateRating(
  value: unknown,
  fieldName: string,
  required = false,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    if (required) {
      return { ok: false, error: `Missing or invalid ${fieldName}` };
    }
    return { ok: true, value: null };
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    return { ok: false, error: `${fieldName} must be an integer between 1 and 5` };
  }

  return { ok: true, value };
}

function extractFirstName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "Client";
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function resolveTestimonialFields(
  input: AdviserFeedbackInput,
  clientDisplayName: string,
): {
  permissionToUseAsTestimonial: boolean;
  testimonialAnonymous: boolean;
  testimonialDisplayName: string | null;
} {
  const permission = input.permissionToUseAsTestimonial === true;
  const preference = input.testimonialDisplayPreference ?? "anonymous";

  if (!permission) {
    return {
      permissionToUseAsTestimonial: false,
      testimonialAnonymous: true,
      testimonialDisplayName: null,
    };
  }

  if (preference === "anonymous") {
    return {
      permissionToUseAsTestimonial: true,
      testimonialAnonymous: true,
      testimonialDisplayName: null,
    };
  }

  if (preference === "first_name") {
    return {
      permissionToUseAsTestimonial: true,
      testimonialAnonymous: false,
      testimonialDisplayName: extractFirstName(clientDisplayName),
    };
  }

  return {
    permissionToUseAsTestimonial: true,
    testimonialAnonymous: false,
    testimonialDisplayName: clientDisplayName.trim() || null,
  };
}

export function shouldShowFeedbackPrompt(client: ClientFeedbackFields): boolean {
  if (!ONBOARDING_COMPLETE_STATUSES.has(client.status)) {
    return false;
  }

  if (!client.advisor_user_id) {
    return false;
  }

  if (client.feedback_submitted_at) {
    return false;
  }

  if (client.feedback_prompt_dismissed_at) {
    const dismissedAt = new Date(client.feedback_prompt_dismissed_at);
    if (!Number.isNaN(dismissedAt.getTime())) {
      const elapsedMs = Date.now() - dismissedAt.getTime();
      const cooldownMs = FEEDBACK_DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      if (elapsedMs < cooldownMs) {
        return false;
      }
    }
  }

  return true;
}

async function mapFeedbackRow(
  row: FeedbackRow,
  extras?: {
    adviserName?: string | null;
    clientDisplayName?: string | null;
  },
): Promise<AdviserFeedbackRecord> {
  return {
    id: row.id,
    clientUserId: row.client_user_id,
    clientId: row.client_id,
    adviserUserId: row.adviser_user_id,
    adviserName: extras?.adviserName ?? null,
    clientDisplayName: extras?.clientDisplayName ?? null,
    ratingOverall: row.rating_overall,
    ratingClarity: row.rating_clarity,
    ratingResponsiveness: row.rating_responsiveness,
    ratingTrust: row.rating_trust,
    ratingProfessionalism: row.rating_professionalism,
    feedbackText: row.feedback_text,
    whatWentWell: row.what_went_well,
    whatCouldImprove: row.what_could_improve,
    permissionToUseAsTestimonial: row.permission_to_use_as_testimonial,
    testimonialDisplayName: row.testimonial_display_name,
    testimonialAnonymous: row.testimonial_anonymous,
    status: mapStatus(row.status),
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rejectForbiddenFeedbackFields(body: unknown): {
  rejected: boolean;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { rejected: false };
  }

  const forbidden = [
    "id",
    "client_user_id",
    "clientUserId",
    "client_id",
    "clientId",
    "adviser_user_id",
    "adviserUserId",
    "status",
    "admin_notes",
    "adminNotes",
    "created_at",
    "createdAt",
  ] as const;

  for (const key of forbidden) {
    if (key in body) {
      return {
        rejected: true,
        error: `${key} must not be supplied by the client`,
      };
    }
  }

  return { rejected: false };
}

export function validateFeedbackInput(
  input: AdviserFeedbackInput,
): { ok: true } | { ok: false; error: string } {
  const overall = validateRating(input.ratingOverall, "rating_overall", true);
  if (!overall.ok) {
    return overall;
  }

  for (const [field, value] of [
    ["rating_clarity", input.ratingClarity],
    ["rating_responsiveness", input.ratingResponsiveness],
    ["rating_trust", input.ratingTrust],
    ["rating_professionalism", input.ratingProfessionalism],
  ] as const) {
    const result = validateRating(value, field);
    if (!result.ok) {
      return result;
    }
  }

  if (
    input.testimonialDisplayPreference &&
    !(TESTIMONIAL_DISPLAY_PREFERENCES as readonly string[]).includes(
      input.testimonialDisplayPreference,
    )
  ) {
    return { ok: false, error: "Invalid testimonial display preference" };
  }

  return { ok: true };
}

export async function loadFeedbackPromptState(): Promise<
  | { ok: false; reason: "unauthenticated" }
  | { ok: true; prompt: FeedbackPromptState }
> {
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { ok: false, reason: "unauthenticated" };
  }

  const client = session.client as ClientFeedbackFields;
  const shouldPrompt = shouldShowFeedbackPrompt(client);

  let adviserName: string | null = null;
  let adviserCompany: string | null = null;

  if (client.advisor_user_id) {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("users")
      .select("full_name, organisation")
      .eq("id", client.advisor_user_id)
      .maybeSingle();

    const adviser = data as { full_name: string | null; organisation: string | null } | null;
    adviserName = adviser?.full_name?.trim() || null;
    adviserCompany = adviser?.organisation?.trim() || null;
  }

  return {
    ok: true,
    prompt: {
      shouldPrompt,
      adviserName,
      adviserCompany,
      alreadySubmitted: Boolean(client.feedback_submitted_at),
    },
  };
}

export async function markFeedbackPrompted(clientId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("clients")
    .update({ feedback_prompted_at: new Date().toISOString() } as never)
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to record feedback prompt: ${error.message}`);
  }
}

export async function dismissFeedbackPrompt(): Promise<
  | { ok: false; reason: "unauthenticated" }
  | { ok: true }
> {
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { ok: false, reason: "unauthenticated" };
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("clients")
    .update({ feedback_prompt_dismissed_at: new Date().toISOString() } as never)
    .eq("id", session.client.id);

  if (error) {
    throw new Error(`Failed to dismiss feedback prompt: ${error.message}`);
  }

  return { ok: true };
}

export async function submitAdviserFeedback(
  input: AdviserFeedbackInput,
): Promise<
  | { ok: false; reason: "unauthenticated" | "not_eligible" | "already_submitted" }
  | { ok: true; feedback: AdviserFeedbackRecord }
> {
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { ok: false, reason: "unauthenticated" };
  }

  const client = session.client as ClientFeedbackFields;

  if (client.feedback_submitted_at) {
    return { ok: false, reason: "already_submitted" };
  }

  if (!client.advisor_user_id || !ONBOARDING_COMPLETE_STATUSES.has(client.status)) {
    return { ok: false, reason: "not_eligible" };
  }

  const validation = validateFeedbackInput(input);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const testimonial = resolveTestimonialFields(input, client.display_name);
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("adviser_feedback")
    .insert({
      client_user_id: session.authUser.id,
      client_id: client.id,
      adviser_user_id: client.advisor_user_id,
      rating_overall: input.ratingOverall,
      rating_clarity: input.ratingClarity ?? null,
      rating_responsiveness: input.ratingResponsiveness ?? null,
      rating_trust: input.ratingTrust ?? null,
      rating_professionalism: input.ratingProfessionalism ?? null,
      feedback_text: input.feedbackText?.trim() || null,
      what_went_well: input.whatWentWell?.trim() || null,
      what_could_improve: input.whatCouldImprove?.trim() || null,
      permission_to_use_as_testimonial: testimonial.permissionToUseAsTestimonial,
      testimonial_display_name: testimonial.testimonialDisplayName,
      testimonial_anonymous: testimonial.testimonialAnonymous,
      status: "submitted",
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to submit feedback: ${error?.message ?? "Unknown error"}`);
  }

  const { error: clientError } = await admin
    .from("clients")
    .update({ feedback_submitted_at: new Date().toISOString() } as never)
    .eq("id", client.id);

  if (clientError) {
    throw new Error(`Failed to update client feedback state: ${clientError.message}`);
  }

  const row = data as FeedbackRow;
  let adviserName: string | null = null;
  if (client.advisor_user_id) {
    const { data: adviser } = await admin
      .from("users")
      .select("full_name")
      .eq("id", client.advisor_user_id)
      .maybeSingle();
    adviserName =
      (adviser as { full_name: string | null } | null)?.full_name?.trim() ?? null;
  }

  return {
    ok: true,
    feedback: await mapFeedbackRow(row, {
      adviserName,
      clientDisplayName: client.display_name,
    }),
  };
}

export type AdvisorFeedbackListFilters = {
  status?: FeedbackStatus | "all";
  adviserUserId?: string | "all";
  minRating?: number;
  sort?: "newest" | "oldest";
};

export async function listAdvisorFeedback(
  authUserId: string,
  userRole: "advisor" | "admin",
  filters: AdvisorFeedbackListFilters = {},
): Promise<{
  feedback: AdviserFeedbackRecord[];
  summaries: AdviserFeedbackSummary[];
  viewer: { userId: string; role: "advisor" | "admin" };
}> {
  const admin = createAdminSupabaseClient();
  let query = admin.from("adviser_feedback").select("*");

  if (userRole === "advisor") {
    query = query.eq("adviser_user_id", authUserId);
  } else if (filters.adviserUserId && filters.adviserUserId !== "all") {
    query = query.eq("adviser_user_id", filters.adviserUserId);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.minRating && filters.minRating >= 1) {
    query = query.gte("rating_overall", filters.minRating);
  }

  const sortAsc = filters.sort === "oldest";
  query = query.order("created_at", { ascending: sortAsc });

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load adviser feedback: ${error.message}`);
  }

  const rows = (data ?? []) as FeedbackRow[];
  const adviserIds = [
    ...new Set(rows.map((row) => row.adviser_user_id).filter(Boolean)),
  ] as string[];
  const clientIds = [
    ...new Set(rows.map((row) => row.client_id).filter(Boolean)),
  ] as string[];

  const adviserNames = new Map<string, string | null>();
  if (adviserIds.length > 0) {
    const { data: advisers } = await admin
      .from("users")
      .select("id, full_name")
      .in("id", adviserIds);
    for (const adviser of (advisers ?? []) as Array<{
      id: string;
      full_name: string | null;
    }>) {
      adviserNames.set(adviser.id, adviser.full_name?.trim() ?? null);
    }
  }

  const clientNames = new Map<string, string | null>();
  if (clientIds.length > 0) {
    const { data: clients } = await admin
      .from("clients")
      .select("id, display_name")
      .in("id", clientIds);
    for (const client of (clients ?? []) as Array<{
      id: string;
      display_name: string;
    }>) {
      clientNames.set(client.id, client.display_name);
    }
  }

  const feedback = await Promise.all(
    rows.map((row) =>
      mapFeedbackRow(row, {
        adviserName: row.adviser_user_id
          ? adviserNames.get(row.adviser_user_id) ?? null
          : null,
        clientDisplayName: row.client_id
          ? clientNames.get(row.client_id) ?? null
          : null,
      }),
    ),
  );

  const summaryMap = new Map<string, AdviserFeedbackSummary>();
  for (const item of feedback) {
    if (!item.adviserUserId) continue;

    const existing = summaryMap.get(item.adviserUserId) ?? {
      adviserUserId: item.adviserUserId,
      adviserName: item.adviserName,
      feedbackCount: 0,
      averageOverallRating: null,
    };

    existing.feedbackCount += 1;
    summaryMap.set(item.adviserUserId, existing);
  }

  for (const summary of summaryMap.values()) {
    const adviserFeedback = feedback.filter(
      (item) => item.adviserUserId === summary.adviserUserId,
    );
    if (adviserFeedback.length > 0) {
      const total = adviserFeedback.reduce(
        (sum, item) => sum + item.ratingOverall,
        0,
      );
      summary.averageOverallRating =
        Math.round((total / adviserFeedback.length) * 10) / 10;
    }
  }

  return {
    feedback,
    summaries: [...summaryMap.values()].sort(
      (a, b) => b.feedbackCount - a.feedbackCount,
    ),
    viewer: { userId: authUserId, role: userRole },
  };
}

export type FeedbackAdminUpdateInput = {
  status?: FeedbackStatus;
  adminNotes?: string | null;
};

export async function updateFeedbackAsAdmin(
  feedbackId: string,
  input: FeedbackAdminUpdateInput,
): Promise<
  | { ok: false; reason: "not_found" | "forbidden_testimonial" }
  | { ok: true; feedback: AdviserFeedbackRecord }
> {
  if (!isValidUuid(feedbackId)) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data: existing, error: loadError } = await admin
    .from("adviser_feedback")
    .select("*")
    .eq("id", feedbackId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load feedback: ${loadError.message}`);
  }

  if (!existing) {
    return { ok: false, reason: "not_found" };
  }

  const row = existing as FeedbackRow;

  if (input.status === "approved_testimonial" && !row.permission_to_use_as_testimonial) {
    return { ok: false, reason: "forbidden_testimonial" };
  }

  const payload: Record<string, unknown> = {};
  if (input.status !== undefined) {
    payload.status = input.status;
  }
  if (input.adminNotes !== undefined) {
    payload.admin_notes = input.adminNotes?.trim() || null;
  }

  if (Object.keys(payload).length === 0) {
    return {
      ok: true,
      feedback: await mapFeedbackRow(row),
    };
  }

  const { data, error } = await admin
    .from("adviser_feedback")
    .update(payload as never)
    .eq("id", feedbackId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to update feedback: ${error?.message ?? "Unknown error"}`);
  }

  return {
    ok: true,
    feedback: await mapFeedbackRow(data as FeedbackRow),
  };
}
