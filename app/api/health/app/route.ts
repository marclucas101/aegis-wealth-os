import { NextResponse } from "next/server";

import { buildAppHealthPayload, type AppHealthPayload } from "@/lib/ops/health";
import { logger } from "@/lib/ops/logger";
import { rateLimitOrThrow } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

export type AppHealthResponse = AppHealthPayload;

export async function GET(
  request: Request,
): Promise<NextResponse<AppHealthResponse>> {
  const startedAt = Date.now();
  const requestId =
    request.headers.get("x-request-id")?.trim() || logger.createRequestId();

  const rateLimit = rateLimitOrThrow<AppHealthResponse>(request, {
    userId: null,
    bucket: "health",
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const payload = buildAppHealthPayload();

  logger.info("App health check", {
    route: "/api/health/app",
    action: "health_check",
    status: 200,
    timingMs: Date.now() - startedAt,
    requestId,
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
