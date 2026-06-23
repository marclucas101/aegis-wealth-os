import { NextResponse } from "next/server";

import { toBinderPublicError } from "@/lib/binder/binderErrors";
import {
  auditBinderDownload,
  createAdviserBinderSignedDownload,
} from "@/lib/binder/binderGenerationService";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import {
  getRequestMetadata,
  privateNoStoreHeaders,
  rateLimitOrThrow,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { dbLoadBinderExportForClient } from "@/lib/supabase/binderExportPersistence";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ clientId: string; binderExportId: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403, headers: privateNoStoreHeaders() },
      );
    }

    const enabled = await isFeatureEnabled("binder_export");
    if (!enabled) {
      return NextResponse.json(
        { ok: false, error: "Binder export is disabled" },
        { status: 403, headers: privateNoStoreHeaders() },
      );
    }

    const { clientId, binderExportId } = await context.params;
    const role = access.user.role === "admin" ? "admin" : "advisor";

    const rateLimit = rateLimitOrThrow(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const clientAccess = await resolveAccessibleClient(access.user.id, role, clientId);
    if (clientAccess.status !== "ok") {
      return NextResponse.json(
        {
          ok: false,
          error:
            clientAccess.status === "forbidden"
              ? "Client not assigned"
              : "Client not found",
        },
        { status: clientAccess.status === "forbidden" ? 403 : 404, headers: privateNoStoreHeaders() },
      );
    }

    const binder = await dbLoadBinderExportForClient(binderExportId, clientId);
    if (!binder) {
      return NextResponse.json(
        { ok: false, error: "BINDER_ACCESS_DENIED" },
        { status: 403, headers: privateNoStoreHeaders() },
      );
    }

    const signed = await createAdviserBinderSignedDownload({
      clientId,
      binderExportId,
      adviserUserId: access.user.id,
      userRole: role,
    });

    const metadata = getRequestMetadata(request);
    await auditBinderDownload({
      clientId,
      adviserUserId: access.user.id,
      binderExportId,
      binder,
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json(
      {
        ok: true,
        signedUrl: signed.signedUrl,
        expiresIn: signed.expiresIn,
      },
      { headers: privateNoStoreHeaders() },
    );
  } catch (err) {
    const pub = toBinderPublicError(err, "Failed to create signed URL");
    console.error(
      "[api/advisor/clients/[clientId]/binder-exports/[binderExportId]/signed-url GET]",
      err,
    );
    const status =
      pub.code === "BINDER_ACCESS_DENIED"
        ? 403
        : pub.code === "BINDER_NOT_READY"
          ? 409
          : 500;
    return NextResponse.json(
      { ok: false, error: pub.error },
      { status, headers: privateNoStoreHeaders() },
    );
  }
}
