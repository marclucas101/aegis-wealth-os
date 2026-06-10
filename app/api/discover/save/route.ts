import { NextResponse } from "next/server";

import type {
  RoadmapItemStatus,
  SaveDiscoverProfileInput,
} from "@/lib/aegis/localProfile";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  persistDiscoverProfile,
  type PersistDiscoverResult,
} from "@/lib/supabase/discoverPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type SaveDiscoverRequestBody = SaveDiscoverProfileInput & {
  completedAt?: string;
  roadmapStatuses?: Record<string, RoadmapItemStatus>;
};

export type SaveDiscoverResponse =
  | ({ ok: true } & PersistDiscoverResult)
  | { ok: false; error: string };

function isValidSaveBody(body: unknown): body is SaveDiscoverRequestBody {
  if (!body || typeof body !== "object") return false;

  const candidate = body as SaveDiscoverRequestBody;
  return (
    candidate.formData != null &&
    candidate.completeness != null &&
    typeof candidate.discoverScore === "number" &&
    typeof candidate.dataConfidenceFactor === "number"
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse<SaveDiscoverResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const rateLimit = rateLimitOrThrow<SaveDiscoverResponse>(request, {
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

    if (!isValidSaveBody(parsed.body)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid discover profile fields" },
        { status: 400 },
      );
    }

    const body = parsed.body;
    const result = await persistDiscoverProfile(session.client, {
      formData: body.formData,
      completeness: body.completeness,
      discoverScore: body.discoverScore,
      dataConfidenceFactor: body.dataConfidenceFactor,
      completedAt: body.completedAt,
      roadmapStatuses: body.roadmapStatuses,
    });

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: session.client.id,
      userId: session.authUser.id,
      action: "discover_profile_saved",
      entityType: "discover_profiles",
      entityId: result.discoverProfileId,
      metadata: {
        score: result.adjustedShieldScore,
        rating: result.rating,
        discover_score: body.discoverScore,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to save discover profile",
    );

    console.error("[api/discover/save]", err);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
