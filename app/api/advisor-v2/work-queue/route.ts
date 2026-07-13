import { NextResponse } from "next/server";

import { assertCrmV2TodayAccess } from "@/lib/crm-v2/access";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { buildAdviserWorkQueue, WORK_QUEUE_FEATURE_FLAG_KEY } from "@/lib/work-queue/buildAdviserWorkQueue";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

/** Read-only virtual work queue — no persistence, no mutation. */
export async function GET(): Promise<NextResponse> {
  try {
    const access = await assertCrmV2TodayAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const workQueueEnabled = await isFeatureEnabled(WORK_QUEUE_FEATURE_FLAG_KEY);
    if (!workQueueEnabled) {
      return NextResponse.json(
        { ok: false, reason: "feature_disabled" },
        {
          status: 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const queue = await buildAdviserWorkQueue({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
    });

    return NextResponse.json(
      {
        ok: true,
        queue: {
          generatedAt: queue.generatedAt,
          items: queue.items,
          summary: queue.summary,
          adapterStatus: queue.adapterStatus,
          readOnly: true,
        },
      },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load work queue") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
