import { NextResponse } from "next/server";

import { assertCrmV2ClientServiceAccess } from "@/lib/crm-v2/access";
import { getClientServiceRequest } from "@/lib/crm-v2/service/service";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
): Promise<NextResponse> {
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

    const { requestId } = await context.params;
    const result = await getClientServiceRequest(access.client.id, requestId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason },
        {
          status: 404,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      { ok: true, ...result.data },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load request") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
