import { NextResponse } from "next/server";

import { toBinderPublicError } from "@/lib/binder/binderErrors";
import { listBinderExportsForAdviserClient } from "@/lib/binder/binderGenerationService";
import type { BinderGenerationStatus } from "@/lib/binder/binderPdfTypes";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import {
  privateNoStoreHeaders,
  rateLimitOrThrow,
  validateEnum,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

const ALLOWED_STATUS_FILTERS = [
  "pending",
  "generating",
  "ready",
  "failed",
  "legacy_manifest",
] as const;

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "commandCenter" });
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

    const enabled = await isFeatureEnabled("binder_export");
    if (!enabled) {
      return NextResponse.json(
        { ok: false, error: "Binder export is disabled" },
        { status: 403, headers: privateNoStoreHeaders() },
      );
    }

    const { clientId } = await context.params;
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

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("generationStatus");
    let generationStatus: BinderGenerationStatus | undefined;
    if (statusParam) {
      const validated = validateEnum(
        statusParam,
        ALLOWED_STATUS_FILTERS,
        "generationStatus",
      );
      if (!validated.ok) {
        return NextResponse.json(
          { ok: false, error: validated.error },
          { status: 400, headers: privateNoStoreHeaders() },
        );
      }
      generationStatus = validated.value;
    }

    const binders = await listBinderExportsForAdviserClient({
      clientId,
      adviserUserId: access.user.id,
      userRole: role,
      generationStatus,
    });

    return NextResponse.json(
      {
        ok: true,
        binders: binders.map((binder) => ({
          id: binder.id,
          binderLineageId: binder.binderLineageId,
          version: binder.version,
          generationStatus: binder.generationStatus,
          lifecycleStatus: binder.lifecycleStatus,
          sectionsIncluded: binder.sectionsIncluded,
          meetingDate: binder.meetingDate,
          createdAt: binder.createdAt,
          generationCompletedAt: binder.generationCompletedAt,
        })),
      },
      { headers: privateNoStoreHeaders() },
    );
  } catch (err) {
    const pub = toBinderPublicError(err, "Failed to list binder exports");
    console.error("[api/advisor/clients/[clientId]/binder-exports GET]", err);
    return NextResponse.json(
      { ok: false, error: pub.error },
      { status: pub.code === "BINDER_ACCESS_DENIED" ? 403 : 500, headers: privateNoStoreHeaders() },
    );
  }
}
