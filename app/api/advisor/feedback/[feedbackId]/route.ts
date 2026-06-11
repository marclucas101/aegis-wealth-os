import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  FEEDBACK_STATUSES,
  updateFeedbackAsAdmin,
  type AdviserFeedbackRecord,
  type FeedbackStatus,
} from "@/lib/supabase/adviserFeedbackPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type AdvisorFeedbackUpdateResponse =
  | { ok: true; feedback: AdviserFeedbackRecord }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "not_found" | "error";
      error?: string;
    };

type RouteContext = {
  params: Promise<{ feedbackId: string }>;
};

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

async function markFeedbackReviewedByAdviser(
  feedbackId: string,
  adviserUserId: string,
): Promise<
  | { ok: false; reason: "not_found" }
  | { ok: true; feedback: AdviserFeedbackRecord }
> {
  const admin = createAdminSupabaseClient();
  const { data: existing, error: loadError } = await admin
    .from("adviser_feedback")
    .select("*")
    .eq("id", feedbackId)
    .eq("adviser_user_id", adviserUserId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load feedback: ${loadError.message}`);
  }

  if (!existing) {
    return { ok: false, reason: "not_found" };
  }

  const { data, error } = await admin
    .from("adviser_feedback")
    .update({ status: "reviewed" } as never)
    .eq("id", feedbackId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to update feedback: ${error?.message ?? "Unknown error"}`);
  }

  const row = data as {
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

  return {
    ok: true,
    feedback: {
      id: row.id,
      clientUserId: row.client_user_id,
      clientId: row.client_id,
      adviserUserId: row.adviser_user_id,
      adviserName: null,
      clientDisplayName: null,
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
      status: row.status as FeedbackStatus,
      adminNotes: row.admin_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorFeedbackUpdateResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Advisor access required",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "forbidden", error: "Advisor access required" },
        { status: 403 },
      );
    }

    const rateLimit = rateLimitOrThrow<AdvisorFeedbackUpdateResponse>(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: parsed.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      rejectClientId: true,
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: sensitiveReject.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Request body is required" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const { feedbackId } = await context.params;

    if (role === "advisor") {
      if (body.status !== "reviewed") {
        return NextResponse.json(
          {
            ok: false,
            reason: "forbidden",
            error: "Advisers may only mark feedback as reviewed",
          },
          { status: 403 },
        );
      }

      const result = await markFeedbackReviewedByAdviser(
        feedbackId,
        access.authUser.id,
      );

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, reason: "not_found", error: "Feedback not found" },
          { status: 404 },
        );
      }

      const metadata = getRequestMetadata(request);
      await writeAuditLog({
        userId: access.authUser.id,
        action: "adviser_feedback_reviewed",
        entityType: "adviser_feedback",
        entityId: result.feedback.id,
        metadata: { feedback_id: result.feedback.id, status: "reviewed" },
        ipAddress: metadata.ip_address,
        userAgent: metadata.user_agent,
      });

      return NextResponse.json({ ok: true, feedback: result.feedback });
    }

    const update: {
      status?: FeedbackStatus;
      adminNotes?: string | null;
    } = {};

    if (body.status !== undefined) {
      const statusResult = validateEnum<FeedbackStatus>(
        body.status,
        FEEDBACK_STATUSES,
        "status",
      );
      if (!statusResult.ok) {
        return NextResponse.json(
          { ok: false, reason: "error", error: statusResult.error },
          { status: 400 },
        );
      }
      update.status = statusResult.value;
    }

    if (body.admin_notes !== undefined || body.adminNotes !== undefined) {
      const value = body.admin_notes ?? body.adminNotes;
      if (value !== null && typeof value !== "string") {
        return NextResponse.json(
          { ok: false, reason: "error", error: "Missing or invalid admin_notes" },
          { status: 400 },
        );
      }
      update.adminNotes = value as string | null;
    }

    const result = await updateFeedbackAsAdmin(feedbackId, update);

    if (!result.ok) {
      if (result.reason === "forbidden_testimonial") {
        return NextResponse.json(
          {
            ok: false,
            reason: "error",
            error: "Testimonial approval requires explicit client consent",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { ok: false, reason: "not_found", error: "Feedback not found" },
        { status: 404 },
      );
    }

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "adviser_feedback_updated",
      entityType: "adviser_feedback",
      entityId: result.feedback.id,
      metadata: {
        feedback_id: result.feedback.id,
        status: result.feedback.status,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, feedback: result.feedback });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to update feedback");
    console.error("[api/advisor/feedback/[feedbackId] PATCH]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
