import { NextResponse } from "next/server";

import { assertCrmV2ServiceAccess } from "@/lib/crm-v2/access";
import type { CrmCommitmentLifecycleStatus } from "@/lib/crm-v2/service/commitmentLifecycle";
import { CRM_COMMITMENT_LIFECYCLE_STATUSES } from "@/lib/crm-v2/service/commitmentLifecycle";
import type { CrmCommitmentTransitionReasonCode } from "@/lib/crm-v2/service/commitmentLifecycle";
import { transitionAdviserCommitment } from "@/lib/crm-v2/service/service";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";
const ALLOWED = new Set<string>(CRM_COMMITMENT_LIFECYCLE_STATUSES);

export async function POST(
  request: Request,
  context: { params: Promise<{ commitmentId: string }> },
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ServiceAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const rateLimit = rateLimitOrThrow(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) return rateLimit.response;

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      rejectClientId: false,
      extraFields: ["adviserUserId", "clientId"],
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json({ ok: false, error: sensitiveReject.error }, { status: 400 });
    }

    const body = (parsed.body ?? {}) as Record<string, unknown>;
    const toStatus = String(body.toStatus);
    if (!ALLOWED.has(toStatus)) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }

    const { commitmentId } = await context.params;
    const result = await transitionAdviserCommitment({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      commitmentId,
      toStatus: toStatus as CrmCommitmentLifecycleStatus,
      reasonCode: String(body.reasonCode ?? "adviser_progressed") as CrmCommitmentTransitionReasonCode,
      version: Number(body.version),
      completionNote: body.completionNote ? String(body.completionNote) : null,
      completionEvidence: body.completionEvidence ? String(body.completionEvidence) : null,
      cancelReason: body.cancelReason ? String(body.cancelReason) : null,
      requestId: access.requestId,
      now: new Date().toISOString(),
    });

    if (!result.ok) {
      const status =
        result.reason === "not_found" ? 404 : result.reason === "conflict" ? 409 : 400;
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        { status, headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
      );
    }

    return NextResponse.json(
      { ok: true, commitment: result.data },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to transition commitment") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
