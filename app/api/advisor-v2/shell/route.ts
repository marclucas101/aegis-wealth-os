import { NextResponse } from "next/server";

import { assertCrmV2Access } from "@/lib/crm-v2/access";

export const dynamic = "force-dynamic";

/** Safe shell gate probe — no business data, no allowlist disclosure. */
export async function GET() {
  const access = await assertCrmV2Access();

  const body = {
    available: access.allowed,
    requestId: access.requestId,
  };

  const status = access.allowed
    ? 200
    : access.reason === "unauthenticated"
      ? 401
      : 403;

  return NextResponse.json(body, {
    status,
    headers: {
      "X-Request-Id": access.requestId,
      "Cache-Control": "no-store",
    },
  });
}
