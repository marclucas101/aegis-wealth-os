import "server-only";

import { NextResponse } from "next/server";

import { logError } from "@/lib/ops/logger";
import { privateNoStoreHeaders } from "@/lib/security/apiGuards";

import {
  resolvePlanningOutputPublicError,
  type PlanningOutputOperation,
  type PlanningOutputPublicError,
} from "./planningOutputErrors";

export type PlanningOutputRouteStage =
  | "auth"
  | "rate_limit"
  | "client_access"
  | "assignment"
  | "params"
  | "validation"
  | "allowlist"
  | "existing_output"
  | "source_resolution"
  | "payload_preparation"
  | "draft_persistence"
  | "review_transition"
  | "output_lookup"
  | "state_validation"
  | "database_update"
  | "post_update_read"
  | "audit"
  | "publication_transition";

export function planningOutputErrorResponse(input: {
  err: unknown;
  operation: PlanningOutputOperation;
  stage: PlanningOutputRouteStage;
  requestId: string;
  clientId: string | null;
  adviserUserId: string | null;
  outputId?: string | null;
  outputType?: string | null;
  lifecycleStatus?: string | null;
  fallbackMessage?: string;
}): NextResponse<{ ok: false; error: PlanningOutputPublicError }> {
  const resolved = resolvePlanningOutputPublicError(input.err, {
    fallbackMessage: input.fallbackMessage,
    operation: input.operation,
  });

  logError("planning output route failed", {
    requestId: input.requestId,
    route: "publications",
    operation: input.operation,
    stage: input.stage,
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    outputId: input.outputId ?? null,
    outputType: input.outputType ?? null,
    lifecycleStatus: input.lifecycleStatus ?? null,
    code: resolved.code,
  });

  return NextResponse.json(
    {
      ok: false as const,
      error: {
        code: resolved.code,
        message: resolved.message,
      },
    },
    { status: resolved.httpStatus, headers: privateNoStoreHeaders() },
  );
}
