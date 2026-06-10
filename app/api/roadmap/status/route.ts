import { NextResponse } from "next/server";

import type { RoadmapItemStatus } from "@/lib/aegis/localProfile";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  isValidRoadmapStatus,
  persistRoadmapItemStatus,
  type PersistRoadmapStatusResult,
} from "@/lib/supabase/roadmapPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type RoadmapStatusRequestBody = {
  item_key: string;
  status: RoadmapItemStatus;
};

export type RoadmapStatusResponse =
  | ({ ok: true } & PersistRoadmapStatusResult)
  | { ok: false; error: string };

const ROADMAP_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const satisfies readonly RoadmapItemStatus[];

export async function POST(
  request: Request,
): Promise<NextResponse<RoadmapStatusResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const rateLimit = rateLimitOrThrow<RoadmapStatusResponse>(request, {
      userId: session.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400 },
      );
    }

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body);
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, error: sensitiveReject.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid item_key or status" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const itemKeyResult = validateRequiredString(body.item_key, "item_key");
    if (!itemKeyResult.ok) {
      return NextResponse.json(
        { ok: false, error: itemKeyResult.error },
        { status: 400 },
      );
    }

    const statusResult = validateEnum(
      body.status,
      ROADMAP_STATUSES,
      "status",
    );
    if (!statusResult.ok || !isValidRoadmapStatus(statusResult.value)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid item_key or status" },
        { status: 400 },
      );
    }

    const result = await persistRoadmapItemStatus(
      session.client,
      itemKeyResult.value,
      statusResult.value,
    );

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: session.client.id,
      userId: session.authUser.id,
      action: "roadmap_status_updated",
      entityType: "roadmap_items",
      entityId: null,
      metadata: {
        item_key: result.item_key,
        status: result.status,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to update roadmap status",
    );

    console.error("[api/roadmap/status]", err);

    const status = message === "Roadmap item not found" ? 404 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
