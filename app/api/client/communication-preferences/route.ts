import { NextResponse } from "next/server";

import {
  assertActiveClientPortalAccess,
  CLIENT_API_CACHE_HEADERS,
} from "@/lib/compliance/activeClientAccess";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  dbLoadCommunicationPreferences,
  dbUpdateCommunicationPreferences,
} from "@/lib/supabase/communicationPreferencesPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const access = await assertActiveClientPortalAccess({
      user: session.user,
      client: session.client,
    });

    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, error: access.reason },
        { status: access.status, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const enabled = await isFeatureEnabled("communication_preferences");
    if (!enabled) {
      return NextResponse.json(
        { ok: false, error: "Communication preferences are not available" },
        { status: 403, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const prefs = await dbLoadCommunicationPreferences(session.client.id);

    return NextResponse.json(
      {
        ok: true,
        preferences: {
          inAppOperational: prefs.in_app_operational,
          emailOperational: prefs.email_operational,
          educationalInsights: prefs.educational_insights,
          marketUpdates: prefs.market_updates,
          eventAnnouncements: prefs.event_announcements,
          adviserMessages: prefs.adviser_messages,
          promotionalContent: prefs.promotional_content,
        },
      },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    console.error("[api/client/communication-preferences GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load preferences") },
      { status: 500, headers: CLIENT_API_CACHE_HEADERS },
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }

    const access = await assertActiveClientPortalAccess({
      user: session.user,
      client: session.client,
    });

    if (!access.allowed) {
      return NextResponse.json({ ok: false, error: access.reason }, { status: access.status });
    }

    const enabled = await isFeatureEnabled("communication_preferences");
    if (!enabled) {
      return NextResponse.json({ ok: false, error: "Communication preferences are not available" }, { status: 403 });
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json({ ok: false, error: clientIdReject.error }, { status: 400 });
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, { rejectClientId: true });
    if (sensitiveReject.rejected) {
      return NextResponse.json({ ok: false, error: sensitiveReject.error }, { status: 400 });
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json({ ok: false, error: "Request body is required" }, { status: 400 });
    }

    const body = parsed.body as Record<string, unknown>;

    const patch: Record<string, boolean> = {};
    if (typeof body.inAppOperational === "boolean") patch.in_app_operational = body.inAppOperational;
    if (typeof body.emailOperational === "boolean") patch.email_operational = body.emailOperational;
    if (typeof body.educationalInsights === "boolean") patch.educational_insights = body.educationalInsights;
    if (typeof body.marketUpdates === "boolean") patch.market_updates = body.marketUpdates;
    if (typeof body.eventAnnouncements === "boolean") patch.event_announcements = body.eventAnnouncements;
    if (typeof body.adviserMessages === "boolean") patch.adviser_messages = body.adviserMessages;
    if (typeof body.promotionalContent === "boolean") patch.promotional_content = body.promotionalContent;

    const updated = await dbUpdateCommunicationPreferences(session.client.id, patch);

    const meta = getRequestMetadata(request);
    await writeAuditLog({
      clientId: session.client.id,
      userId: session.user.id,
      action: "communication_preference_changed",
      entityType: "communication_preferences",
      entityId: session.client.id,
      metadata: { fields: Object.keys(patch) },
      ...meta,
    });

    return NextResponse.json({
      ok: true,
      preferences: {
        inAppOperational: updated.in_app_operational,
        emailOperational: updated.email_operational,
        educationalInsights: updated.educational_insights,
        marketUpdates: updated.market_updates,
        eventAnnouncements: updated.event_announcements,
        adviserMessages: updated.adviser_messages,
        promotionalContent: updated.promotional_content,
      },
    });
  } catch (err) {
    console.error("[api/client/communication-preferences PATCH]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update preferences") },
      { status: 500 },
    );
  }
}
