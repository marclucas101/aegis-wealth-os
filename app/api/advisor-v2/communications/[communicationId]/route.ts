import { NextResponse } from "next/server";

import { assertCrmV2CommunicationsAccess } from "@/lib/crm-v2/access";
import { updateCommunicationRecord } from "@/lib/crm-v2/communications/communications";
import type { UpdateCommunicationRecordInput } from "@/lib/crm-v2/communications/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

type RouteContext = { params: Promise<{ communicationId: string }> };

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2CommunicationsAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const body = (await request.json()) as UpdateCommunicationRecordInput;
    const { communicationId } = await context.params;
    const result = await updateCommunicationRecord({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      communicationId,
      payload: body,
      requestId: access.requestId,
    });

    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "forbidden"
            ? 403
            : result.reason === "conflict"
              ? 409
              : 400;
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        {
          status,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      { ok: true, record: result.data },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update communication") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
