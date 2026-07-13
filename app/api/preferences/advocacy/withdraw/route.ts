import { NextResponse } from "next/server";

import { assertCrmV2ClientAdvocacyAccess } from "@/lib/crm-v2/access";
import { withdrawClientAdvocacyConsent } from "@/lib/crm-v2/advocacy/advocacy";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientAdvocacyAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const body = (await request.json()) as { expectedVersion: number };
    const result = await withdrawClientAdvocacyConsent({
      authUserId: access.authUserId,
      clientId: access.client.id,
      adviserUserId: access.client.advisor_user_id ?? access.authUserId,
      expectedVersion: body.expectedVersion,
      requestId: access.requestId,
    });

    if (!result.ok) {
      const status =
        result.reason === "conflict" ? 409 : result.reason === "forbidden" ? 403 : 400;
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        {
          status,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      { ok: true, preferences: result.data },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to withdraw consent") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
