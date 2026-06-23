import { NextResponse } from "next/server";

import { canPublishClientOutput } from "@/lib/compliance/entitlements";
import {
  isPlanningOutputPrepareAllowed,
  preparePlanningOutputFromSources,
} from "@/lib/compliance/planningOutputPreparation";
import {
  PLANNING_OUTPUT_ERROR_CODES,
  PlanningOutputError,
} from "@/lib/compliance/planningOutputErrors";
import { planningOutputErrorResponse } from "@/lib/compliance/planningOutputRoute";
import { listPublishedOutputsForClient } from "@/lib/compliance/publicationWorkflow";
import { createRequestId } from "@/lib/ops/logger";
import {
  privateNoStoreHeaders,
  rateLimitOrThrow,
  rejectClientIdInBody,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import type { PublishedOutputType } from "@/lib/compliance/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") return role;
  return null;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const requestId = createRequestId();
  let clientId: string | null = null;
  let adviserUserId: string | null = null;

  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }
    adviserUserId = access.user.id;

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }

    clientId = (await context.params).clientId;
    const resolved = await resolveAccessibleClient(
      access.authUser.id,
      role,
      clientId,
    );

    if (resolved.status !== "ok") {
      return NextResponse.json(
        { ok: false, reason: resolved.status },
        { status: resolved.status === "not_found" ? 404 : 403 },
      );
    }

    const outputs = await listPublishedOutputsForClient(clientId);
    return NextResponse.json({ ok: true, outputs }, { headers: privateNoStoreHeaders() });
  } catch (err) {
    return planningOutputErrorResponse({
      err,
      operation: "prepare",
      stage: "source_resolution",
      requestId,
      clientId,
      adviserUserId,
      fallbackMessage: "Unable to load planning outputs.",
    });
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const requestId = createRequestId();
  let stage: Parameters<typeof planningOutputErrorResponse>[0]["stage"] = "auth";
  let clientId: string | null = null;
  let adviserUserId: string | null = null;
  let outputType: PublishedOutputType | null = null;

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
    clientId = (await context.params).clientId;
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

    stage = "validation";
    const body = (await request.json()) as { outputType?: PublishedOutputType };
    const clientIdReject = rejectClientIdInBody(body);
    if (clientIdReject.rejected) {
      throw new PlanningOutputError(
        PLANNING_OUTPUT_ERROR_CODES.PREPARATION_FAILED,
        "Invalid request.",
        400,
      );
    }

    outputType = body.outputType ?? "financial_readiness_snapshot";

    stage = "allowlist";
    if (!isPlanningOutputPrepareAllowed(outputType)) {
      throw new PlanningOutputError(
        PLANNING_OUTPUT_ERROR_CODES.PREPARATION_FAILED,
        "This output type is not supported for preparation.",
        400,
      );
    }

    stage = "source_resolution";
    stage = "payload_preparation";
    const output = await preparePlanningOutputFromSources({
      client: resolved.client,
      outputType,
      actorUserId: access.authUser.id,
    });

    stage = "draft_persistence";
    return NextResponse.json({ ok: true, output }, { headers: privateNoStoreHeaders() });
  } catch (err) {
    return planningOutputErrorResponse({
      err,
      operation: "prepare",
      stage,
      requestId,
      clientId,
      adviserUserId,
      outputType,
    });
  }
}
