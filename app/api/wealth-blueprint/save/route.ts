import { NextResponse } from "next/server";

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
  persistWealthBlueprintSnapshot,
  type PersistReportSnapshotResult,
} from "@/lib/supabase/reportPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type WealthBlueprintSaveResponse =
  | ({ ok: true } & PersistReportSnapshotResult)
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

export async function POST(
  request: Request,
): Promise<NextResponse<WealthBlueprintSaveResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const rateLimit = rateLimitOrThrow<WealthBlueprintSaveResponse>(request, {
      userId: session.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request, { allowEmpty: true });
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, reason: "no_profile", error: parsed.error },
        { status: 400 },
      );
    }

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        {
          ok: false,
          reason: "no_profile",
          error: clientIdReject.error,
        },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body);
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        {
          ok: false,
          reason: "no_profile",
          error: sensitiveReject.error,
        },
        { status: 400 },
      );
    }

    const result = await persistWealthBlueprintSnapshot(session.client);

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: session.client.id,
      userId: session.authUser.id,
      action: "wealth_blueprint_saved",
      entityType: "wealth_blueprints",
      entityId: result.id,
      metadata: {
        generated_at: result.generated_at,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to save wealth blueprint snapshot",
    );

    if (message === "no_profile") {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    console.error("[api/wealth-blueprint/save]", err);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
