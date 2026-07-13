import { NextResponse } from "next/server";

import { assertCrmV2ClientMessagesAccess } from "@/lib/crm-v2/access";
import { loadClientMessages } from "@/lib/crm-v2/communications/communications";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(): Promise<NextResponse> {
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

    const inbox = await loadClientMessages({ clientId: access.client.id });

    return NextResponse.json(
      { ok: true, inbox },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load messages") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
