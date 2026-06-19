import { NextResponse } from "next/server";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";
import { dbListAllDeliveries } from "@/lib/supabase/communicationDeliveryPersistence";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await requireAdminAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const enabled = await isFeatureEnabled("admin_content_approval");
    if (!enabled) {
      return NextResponse.json({ ok: false, error: "Content approval is disabled" }, { status: 403 });
    }

    const rows = await dbListAllDeliveries();

    const deliveries = rows.map((d) => ({
      id: d.id,
      communicationId: d.communication_id,
      clientId: d.client_id,
      channel: d.channel,
      deliveryStatus: d.delivery_status,
      attemptCount: d.attempt_count,
      sentAt: d.sent_at,
      failedAt: d.failed_at,
      createdAt: d.created_at,
    }));

    return NextResponse.json({ ok: true, deliveries });
  } catch (err) {
    console.error("[api/admin/communication-deliveries GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load deliveries") },
      { status: 500 },
    );
  }
}
