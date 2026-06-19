import { NextResponse } from "next/server";

import {
  assertActiveClientPortalAccess,
  CLIENT_API_CACHE_HEADERS,
} from "@/lib/compliance/activeClientAccess";
import { getRequestMetadata, rateLimitOrThrow, toPublicErrorMessage } from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { dbMarkNotificationRead } from "@/lib/supabase/clientNotificationsPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ notificationId: string }> };

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const { notificationId } = await context.params;
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

    const updated = await dbMarkNotificationRead(notificationId, session.client.id);

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Notification not found" },
        { status: 404, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const meta = getRequestMetadata(request);
    await writeAuditLog({
      clientId: session.client.id,
      userId: session.user.id,
      action: "notification_read",
      entityType: "client_notification",
      entityId: notificationId,
      ...meta,
    });

    return NextResponse.json(
      {
        ok: true,
        notification: {
          id: updated.id,
          readAt: updated.read_at,
        },
      },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    console.error("[api/client/notifications/[notificationId] PATCH]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update notification") },
      { status: 500, headers: CLIENT_API_CACHE_HEADERS },
    );
  }
}
