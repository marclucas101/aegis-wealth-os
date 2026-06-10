import { NextResponse } from "next/server";

import { captureServerError } from "@/lib/ops/errorReporting";
import {
  isDatabaseConnectionError,
  isProductionHealthMode,
  sanitizeHealthErrorMessage,
  type SupabaseHealthPayload,
} from "@/lib/ops/health";
import { logger } from "@/lib/ops/logger";
import { rateLimitOrThrow } from "@/lib/security/apiGuards";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type SupabaseHealthResponse = SupabaseHealthPayload;

export async function GET(
  request: Request,
): Promise<NextResponse<SupabaseHealthResponse>> {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();
  const productionMode = isProductionHealthMode();
  const requestId =
    request.headers.get("x-request-id")?.trim() || logger.createRequestId();

  const rateLimit = rateLimitOrThrow<SupabaseHealthResponse>(request, {
    userId: null,
    bucket: "health",
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  try {
    const supabase = createAdminSupabaseClient();

    const { error } = await supabase.from("clients").select("id").limit(1);

    if (error) {
      const reachable = !isDatabaseConnectionError(error.message);

      logger.warn("Supabase health check failed", {
        route: "/api/health/supabase",
        action: "health_check",
        status: 503,
        timingMs: Date.now() - startedAt,
        requestId,
        databaseReachable: reachable,
        tablesAccessible: false,
      });

      return NextResponse.json(
        {
          ok: false,
          databaseReachable: reachable,
          tablesAccessible: false,
          timestamp,
          ...(productionMode
            ? {}
            : { error: sanitizeHealthErrorMessage(error.message) }),
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "X-Request-Id": requestId,
          },
        },
      );
    }

    logger.info("Supabase health check", {
      route: "/api/health/supabase",
      action: "health_check",
      status: 200,
      timingMs: Date.now() - startedAt,
      requestId,
      databaseReachable: true,
      tablesAccessible: true,
    });

    return NextResponse.json(
      {
        ok: true,
        databaseReachable: true,
        tablesAccessible: true,
        timestamp,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (err) {
    const normalized = captureServerError("Supabase health check error", {
      route: "/api/health/supabase",
      action: "health_check",
      status: 500,
      timingMs: Date.now() - startedAt,
      requestId,
      error: err,
    });

    const isEnvError = normalized.message.includes(
      "Missing required environment variable",
    );

    return NextResponse.json(
      {
        ok: false,
        databaseReachable: false,
        tablesAccessible: false,
        timestamp,
        ...(productionMode
          ? {}
          : { error: sanitizeHealthErrorMessage(normalized.message) }),
      },
      {
        status: isEnvError ? 503 : 500,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  }
}
