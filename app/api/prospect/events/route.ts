import { NextResponse } from "next/server";

import {
  canAccessClientFeature,
  getUserExperienceContext,
} from "@/lib/compliance/entitlements";
import {
  safeRecordProspectEvent,
  type ProspectAnalyticsEvent,
} from "@/lib/compliance/prospectAnalytics";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS: ProspectAnalyticsEvent[] = [
  "prospect_onboarding_started",
  "prospect_section_completed",
  "prospect_appointment_cta_selected",
];

type EventBody = {
  event: ProspectAnalyticsEvent;
  sectionId?: string;
  ctaReason?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await ensureUserClientProfile();
    if (!session.authenticated) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }

    const ctx = await getUserExperienceContext({
      user: session.user,
      client: session.client,
    });

    if (!(await canAccessClientFeature(ctx, "financial_readiness_snapshot"))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const rateLimit = rateLimitOrThrow(request, {
      userId: session.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const reject = rejectClientIdInBody(parsed.body);
    if (reject.rejected) {
      return NextResponse.json({ ok: false, error: reject.error }, { status: 400 });
    }

    const body = parsed.body as EventBody;
    if (!body?.event || !ALLOWED_EVENTS.includes(body.event)) {
      return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 });
    }

    const metadata: Record<string, string | number | boolean | null> = {};
    if (body.sectionId) {
      metadata.sectionId = body.sectionId;
    }
    if (body.ctaReason) {
      metadata.ctaReason = body.ctaReason;
    }

    const requestMeta = getRequestMetadata(request);
    await safeRecordProspectEvent({
      clientId: session.client.id,
      userId: session.authUser.id,
      event: body.event,
      metadata,
      ipAddress: requestMeta.ip_address,
      userAgent: requestMeta.user_agent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/prospect/events]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to record event") },
      { status: 500 },
    );
  }
}
