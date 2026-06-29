import { NextResponse } from "next/server";



import { canPublishClientOutput } from "@/lib/compliance/entitlements";

import {

  PLANNING_OUTPUT_ERROR_CODES,

  PlanningOutputError,

} from "@/lib/compliance/planningOutputErrors";

import { planningOutputErrorResponse } from "@/lib/compliance/planningOutputRoute";

import {

  loadPublishedOutputById,

  publishOutput,

} from "@/lib/compliance/publicationWorkflow";

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

  let outputId: string | null = null;

  let outputType: string | null = null;

  let lifecycleStatus: string | null = null;



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



    stage = "params";

    const params = await context.params;

    clientId = params.clientId;

    outputId = params.outputId;



    stage = "client_access";

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



    stage = "output_lookup";

    const preview = await loadPublishedOutputById(outputId);

    outputType = preview?.output_type ?? null;

    lifecycleStatus = preview?.publication_status ?? null;



    const body = (await request.json().catch(() => ({}))) as {

      expiresAt?: string | null;

    };



    stage = "publication_transition";

    const output = await publishOutput(

      outputId,

      access.authUser.id,

      clientId,

      body.expiresAt,

      { requireAssignment: role === "advisor" },

    );



    return NextResponse.json({ ok: true, output }, { headers: privateNoStoreHeaders() });

  } catch (err) {

    return planningOutputErrorResponse({

      err,

      operation: "publish",

      stage,

      requestId,

      clientId,

      adviserUserId,

      outputId,

      outputType,

      lifecycleStatus,

      fallbackMessage: "The output could not be published. Please try again.",

    });

  }

}


