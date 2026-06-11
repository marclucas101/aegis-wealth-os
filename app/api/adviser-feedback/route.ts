import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import {
  rejectForbiddenFeedbackFields,
  submitAdviserFeedback,
  type AdviserFeedbackInput,
  type AdviserFeedbackRecord,
} from "@/lib/supabase/adviserFeedbackPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export type AdviserFeedbackSubmitResponse =
  | { ok: true; feedback: AdviserFeedbackRecord }
  | { ok: false; error: string; reason?: string };

function parseRating(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

function parseFeedbackBody(body: Record<string, unknown>): AdviserFeedbackInput | { error: string } {
  const overall = parseRating(body.rating_overall ?? body.ratingOverall);
  if (overall === undefined || overall === null) {
    return { error: "Missing or invalid rating_overall" };
  }

  const clarity = parseRating(body.rating_clarity ?? body.ratingClarity);
  const responsiveness = parseRating(
    body.rating_responsiveness ?? body.ratingResponsiveness,
  );
  const trust = parseRating(body.rating_trust ?? body.ratingTrust);
  const professionalism = parseRating(
    body.rating_professionalism ?? body.ratingProfessionalism,
  );

  if (
    (body.rating_clarity !== undefined || body.ratingClarity !== undefined) &&
    clarity === null
  ) {
    return { error: "Missing or invalid rating_clarity" };
  }
  if (
    (body.rating_responsiveness !== undefined ||
      body.ratingResponsiveness !== undefined) &&
    responsiveness === null
  ) {
    return { error: "Missing or invalid rating_responsiveness" };
  }
  if (
    (body.rating_trust !== undefined || body.ratingTrust !== undefined) &&
    trust === null
  ) {
    return { error: "Missing or invalid rating_trust" };
  }
  if (
    (body.rating_professionalism !== undefined ||
      body.ratingProfessionalism !== undefined) &&
    professionalism === null
  ) {
    return { error: "Missing or invalid rating_professionalism" };
  }

  const optionalText = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return typeof value === "string" ? value : null;
  };

  const permission =
    body.permission_to_use_as_testimonial ?? body.permissionToUseAsTestimonial;
  const displayPref =
    body.testimonial_display_preference ?? body.testimonialDisplayPreference;

  return {
    ratingOverall: overall,
    ratingClarity: clarity ?? null,
    ratingResponsiveness: responsiveness ?? null,
    ratingTrust: trust ?? null,
    ratingProfessionalism: professionalism ?? null,
    feedbackText: optionalText(body.feedback_text ?? body.feedbackText) ?? null,
    whatWentWell: optionalText(body.what_went_well ?? body.whatWentWell) ?? null,
    whatCouldImprove:
      optionalText(body.what_could_improve ?? body.whatCouldImprove) ?? null,
    permissionToUseAsTestimonial: permission === true,
    testimonialDisplayPreference:
      typeof displayPref === "string"
        ? (displayPref as AdviserFeedbackInput["testimonialDisplayPreference"])
        : undefined,
  };
}

export async function POST(
  request: Request,
): Promise<NextResponse<AdviserFeedbackSubmitResponse>> {
  try {
    const rateLimit = rateLimitOrThrow<AdviserFeedbackSubmitResponse>(request, {
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400 },
      );
    }

    const forbidden = rejectForbiddenFeedbackFields(parsed.body);
    if (forbidden.rejected) {
      return NextResponse.json(
        { ok: false, error: forbidden.error ?? "Invalid request" },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      rejectClientId: true,
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, error: sensitiveReject.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Request body is required" },
        { status: 400 },
      );
    }

    const input = parseFeedbackBody(parsed.body as Record<string, unknown>);
    if ("error" in input) {
      return NextResponse.json(
        { ok: false, error: input.error },
        { status: 400 },
      );
    }

    const result = await submitAdviserFeedback(input);

    if (!result.ok) {
      const status =
        result.reason === "unauthenticated"
          ? 401
          : result.reason === "already_submitted"
            ? 409
            : 403;

      return NextResponse.json(
        {
          ok: false,
          error:
            result.reason === "already_submitted"
              ? "Feedback has already been submitted"
              : result.reason === "not_eligible"
                ? "Feedback is not available for your account"
                : "Authentication required",
          reason: result.reason,
        },
        { status },
      );
    }

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: result.feedback.clientId,
      userId: result.feedback.clientUserId,
      action: "adviser_feedback_submitted",
      entityType: "adviser_feedback",
      entityId: result.feedback.id,
      metadata: {
        feedback_id: result.feedback.id,
        adviser_user_id: result.feedback.adviserUserId,
        rating_overall: result.feedback.ratingOverall,
        testimonial_consent: result.feedback.permissionToUseAsTestimonial,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, feedback: result.feedback }, { status: 201 });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to submit feedback");
    console.error("[api/adviser-feedback POST]", err);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
