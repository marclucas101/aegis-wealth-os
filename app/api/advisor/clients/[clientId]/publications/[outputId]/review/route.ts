import { NextResponse } from "next/server";

import { canPublishClientOutput } from "@/lib/compliance/entitlements";
import {
  PLANNING_OUTPUT_ERROR_CODES,
  PlanningOutputError,
} from "@/lib/compliance/planningOutputErrors";
import { planningOutputErrorResponse } from "@/lib/compliance/planningOutputRoute";
import { reviewPublishedOutput } from "@/lib/compliance/publicationWorkflow";
import { createRequestId } from "@/lib/ops/logger";
import { privateNoStoreHeaders, rateLimitOrThrow } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ clientId: string; outputId: string }>;
};

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") return role;
  return null;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const requestId = createRequestId();
  let stage: Parameters<typeof planningOutputErrorResponse>[0]["stage"] = "auth";
  let clientId: string | null = null;
  let adviserUserId: string | null = null;

  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      throw new PlanningOutputError(
        PLANNING_OUTPUT_ERROR_CODES.ACCESS_DENIED,
        "You no longer have access to prepare outputs for this client.",
        access.reason === "unauthenticated" ? 401 : 403,
      );
    }
    adviserUserId = access.user.id;

    stage = "rate_limit";
    const rateLimit = rateLimitOrThrow(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      throw new PlanningOutputError(
        PLANNING_OUTPUT_ERROR_CODES.ACCESS_DENIED,
        "You no longer have access to prepare outputs for this client.",
        403,
      );
    }

    stage = "client_access";
    const params = await context.params;
    clientId = params.clientId;
    const resolved = await resolveAccessibleClient(
      access.authUser.id,
      role,
      clientId,
    );

    if (resolved.status !== "ok") {
      throw new PlanningOutputError(
        PLANNING_OUTPUT_ERROR_CODES.ACCESS_DENIED,
        "You no longer have access to prepare outputs for this client.",
        resolved.status === "not_found" ? 404 : 403,
      );
    }

    stage = "assignment";
    const isAssigned = resolved.client.advisor_user_id === access.authUser.id;
    const canPublish = await canPublishClientOutput({
      role: access.user.role,
      isAssignedAdviser: isAssigned,
      isAdmin: role === "admin",
    });

    if (!canPublish) {
      throw new PlanningOutputError(
        PLANNING_OUTPUT_ERROR_CODES.ACCESS_DENIED,
        "You no longer have access to prepare outputs for this client.",
        403,
      );
    }

    stage = "review_transition";
    const output = await reviewPublishedOutput(
      params.outputId,
      access.authUser.id,
      clientId,
    );

    return NextResponse.json({ ok: true, output }, { headers: privateNoStoreHeaders() });
  } catch (err) {
    return planningOutputErrorResponse({
      err,
      operation: "review",
      stage,
      requestId,
      clientId,
      adviserUserId,
      fallbackMessage: "The output could not be reviewed. Please try again.",
    });
  }
}
