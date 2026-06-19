import { NextResponse } from "next/server";

import {
  assertActiveClientPortalAccess,
  CLIENT_API_CACHE_HEADERS,
} from "@/lib/compliance/activeClientAccess";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { dbListClientNotifications } from "@/lib/supabase/clientNotificationsPersistence";
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

    const enabled = await isFeatureEnabled("client_in_app_notifications");
    if (!enabled) {
      return NextResponse.json(
        { ok: true, notifications: [] },
        { headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const rows = await dbListClientNotifications(session.client.id);

    const notifications = rows.map((n) => ({
      id: n.id,
      type: n.notification_type,
      title: n.title,
      summary: n.summary,
      referenceType: n.reference_type,
      referenceId: n.reference_id,
      readAt: n.read_at,
      createdAt: n.created_at,
    }));

    return NextResponse.json(
      { ok: true, notifications },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    console.error("[api/client/notifications GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load notifications") },
      { status: 500, headers: CLIENT_API_CACHE_HEADERS },
    );
  }
}
