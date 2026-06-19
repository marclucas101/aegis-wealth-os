import { NextResponse } from "next/server";

import type { SaveDiscoverProfileInput } from "@/lib/aegis/localProfile";
import {
  canAccessClientFeature,
  getUserExperienceContext,
} from "@/lib/compliance/entitlements";
import { submitProspectProfile } from "@/lib/compliance/prospectSubmission";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { persistDiscoverProfile } from "@/lib/supabase/discoverPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type SubmitDiscoverRequestBody = SaveDiscoverProfileInput & {
  privacyAcknowledged?: boolean;
};

export type SubmitDiscoverResponse =
  | {
      ok: true;
      alreadySubmitted: boolean;
      stage: string;
      taskCreated: boolean;
    }
  | {
      ok: false;
      error: string;
      missingSections?: string[];
    };

function isValidSubmitBody(body: unknown): body is SubmitDiscoverRequestBody {
  if (!body || typeof body !== "object") return false;
  const candidate = body as SubmitDiscoverRequestBody;
  return (
    candidate.formData != null &&
    candidate.privacyAcknowledged === true
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse<SubmitDiscoverResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const ctx = await getUserExperienceContext({
      user: session.user,
      client: session.client,
    });

    if (!(await canAccessClientFeature(ctx, "complete_information"))) {
      return NextResponse.json(
        { ok: false, error: "Submission is not available for your account." },
        { status: 403 },
      );
    }

    const rateLimit = rateLimitOrThrow<SubmitDiscoverResponse>(request, {
      userId: session.authUser.id,
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

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body);
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, error: sensitiveReject.error },
        { status: 400 },
      );
    }

    if (!isValidSubmitBody(parsed.body)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing profile fields or privacy acknowledgement is required.",
        },
        { status: 400 },
      );
    }

    const body = parsed.body;

    await persistDiscoverProfile(session.client, {
      formData: body.formData,
      completeness: body.completeness,
      discoverScore: body.discoverScore,
      dataConfidenceFactor: body.dataConfidenceFactor,
    });

    const metadata = getRequestMetadata(request);

    const result = await submitProspectProfile({
      client: session.client,
      actorUserId: session.authUser.id,
      formData: body.formData,
      hasDiscoverData: true,
      privacyAcknowledged: true,
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.message,
          missingSections: result.missingSections,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      alreadySubmitted: result.alreadySubmitted,
      stage: result.stage,
      taskCreated: result.taskCreated,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to submit profile");
    console.error("[api/discover/submit]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
