import { NextResponse } from "next/server";

import { toBinderPublicError } from "@/lib/binder/binderErrors";
import { withdrawBinderFromClient } from "@/lib/binder/binderWithdrawalService";
import { BINDER_WITHDRAWAL_REASONS } from "@/lib/binder/binderPublicationTypes";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import {
  parseJsonBodySafely,
  privateNoStoreHeaders,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  validateEnum,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ clientId: string; binderExportId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403, headers: privateNoStoreHeaders() },
      );
    }

    const publicationEnabled = await isFeatureEnabled("binder_client_publication");
    if (!publicationEnabled) {
      return NextResponse.json(
        { ok: false, error: "BINDER_PUBLICATION_DENIED" },
        { status: 403, headers: privateNoStoreHeaders() },
      );
    }

    const { clientId, binderExportId } = await context.params;
    const role = access.user.role === "admin" ? "admin" : "advisor";

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

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400, headers: privateNoStoreHeaders() },
      );
    }

    const body =
      parsed.body && typeof parsed.body === "object"
        ? (parsed.body as Record<string, unknown>)
        : {};

    const clientIdReject = rejectClientIdInBody(body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400, headers: privateNoStoreHeaders() },
      );
    }

    const unexpected = rejectUnexpectedFields(body, {
      rejectClientId: true,
      allowFields: ["reason"],
    });
    if (unexpected.rejected) {
      return NextResponse.json(
        { ok: false, error: unexpected.error },
        { status: 400, headers: privateNoStoreHeaders() },
      );
    }

    const reasonResult = validateEnum(
      body.reason,
      BINDER_WITHDRAWAL_REASONS,
      "reason",
    );
    if (!reasonResult.ok) {
      return NextResponse.json(
        { ok: false, error: reasonResult.error },
        { status: 400, headers: privateNoStoreHeaders() },
      );
    }

    const result = await withdrawBinderFromClient({
      clientId,
      binderExportId,
      adviserUserId: access.user.id,
      userRole: role,
      reason: reasonResult.value,
    });

    return NextResponse.json(
      {
        ok: true,
        withdrawal: {
          binderExportId: result.binderExportId,
          version: result.version,
          publicationStatus: result.publicationStatus,
          withdrawnAt: result.withdrawnAt,
          reused: result.reused,
        },
      },
      { headers: privateNoStoreHeaders() },
      );
  } catch (err) {
    const pub = toBinderPublicError(err, "Failed to withdraw binder");
    console.error(
      "[api/advisor/clients/[clientId]/binder-exports/[binderExportId]/withdraw POST]",
      err,
    );
    const status =
      pub.code === "BINDER_ACCESS_DENIED" || pub.code === "BINDER_PUBLICATION_DENIED"
        ? 403
        : pub.code === "BINDER_NOT_PUBLISHABLE"
          ? 409
          : 500;
    return NextResponse.json(
      { ok: false, error: pub.error },
      { status, headers: privateNoStoreHeaders() },
    );
  }
}
