import { NextResponse } from "next/server";

import { assertCrmV2ClientMessagesAccess } from "@/lib/crm-v2/access";
import { createCrmCommunicationsAdmin } from "@/lib/crm-v2/communications/db";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

type RouteContext = { params: Promise<{ messageId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientMessagesAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const { messageId } = await context.params;
    const admin = createCrmCommunicationsAdmin();
    const { data } = await admin
      .from("crm_communication_records")
      .select("id, safe_subject, safe_body, direction, updated_at, version, lifecycle_status, client_visibility")
      .eq("id", messageId)
      .eq("client_id", access.client.id)
      .eq("active", true)
      .in("client_visibility", ["client_visible", "both"])
      .in("lifecycle_status", ["sent", "logged", "received"])
      .maybeSingle();

    if (!data) {
      return NextResponse.json(
        { ok: false, reason: "not_found" },
        {
          status: 404,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const row = data as {
      id: string;
      safe_subject: string;
      safe_body: string | null;
      direction: string;
      updated_at: string;
      version: number;
    };

    return NextResponse.json(
      {
        ok: true,
        message: {
          messageId: row.id,
          safeSubject: row.safe_subject,
          safeBody: row.safe_body ?? "",
          direction: row.direction,
          occurredAt: row.updated_at,
          canReply: row.direction === "outbound",
          version: row.version,
        },
      },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load message") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
