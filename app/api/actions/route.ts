import { NextResponse } from "next/server";

import { assertCrmV2ClientServiceAccess } from "@/lib/crm-v2/access";
import { listClientActions } from "@/lib/crm-v2/service/service";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientServiceAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const actions = await listClientActions(access.client.id);
    return NextResponse.json(
      { ok: true, actions },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load actions") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
