import { NextResponse } from "next/server";

import { assertCrmV2ServiceAccess } from "@/lib/crm-v2/access";
import {
  createAdviserCommitment,
  listAdviserCommitments,
} from "@/lib/crm-v2/service/service";
import type { CrmCommitmentOwner } from "@/lib/crm-v2/service/commitmentLifecycle";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";
const OWNERS = new Set<CrmCommitmentOwner>(["adviser", "client", "shared"]);

export async function GET(): Promise<NextResponse> {
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

    const commitments = await listAdviserCommitments({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
    });

    return NextResponse.json(
      { ok: true, commitments },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load commitments") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
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
      extraFields: ["adviserUserId", "adviser_user_id", "clientId", "client_id"],
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json({ ok: false, error: sensitiveReject.error }, { status: 400 });
    }

    const body = (parsed.body ?? {}) as Record<string, unknown>;
    const owner = String(body.owner ?? "") as CrmCommitmentOwner;
    if (!OWNERS.has(owner)) {
      return NextResponse.json({ ok: false, error: "Invalid owner" }, { status: 400 });
    }

    const result = await createAdviserCommitment({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      relationshipId: String(body.relationshipId),
      owner,
      title: String(body.title),
      description: body.description ? String(body.description) : null,
      dueAt: body.dueAt ? String(body.dueAt) : null,
      clientVisible: Boolean(body.clientVisible),
      internalNote: body.internalNote ? String(body.internalNote) : null,
      appointmentId: body.appointmentId ? String(body.appointmentId) : null,
      sourceType: body.sourceType ? String(body.sourceType) : null,
      sourceId: body.sourceId ? String(body.sourceId) : null,
      idempotencyKey: body.idempotencyKey ? String(body.idempotencyKey) : undefined,
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
        status: 201,
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to create commitment") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
