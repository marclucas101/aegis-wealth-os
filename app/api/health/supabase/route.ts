import { NextResponse } from "next/server";

import { rateLimitOrThrow } from "@/lib/security/apiGuards";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type SupabaseHealthResponse = {
  ok: boolean;
  timestamp: string;
  databaseReachable: boolean;
  tablesAccessible: boolean;
  error?: string;
};

function isProductionHealthMode(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/(service[_-]?role|anon|api)[_-]?key[=:\s]+[^\s]+/gi, "[redacted]")
    .replace(/\b(public\.|from\s+)\w+/gi, "[redacted]");
}

function isConnectionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound") ||
    normalized.includes("timeout") ||
    normalized.includes("failed to fetch")
  );
}

export async function GET(
  request: Request,
): Promise<NextResponse<SupabaseHealthResponse>> {
  const timestamp = new Date().toISOString();
  const productionMode = isProductionHealthMode();

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
      const reachable = !isConnectionError(error.message);

      return NextResponse.json(
        {
          ok: false,
          databaseReachable: reachable,
          tablesAccessible: false,
          timestamp,
          ...(productionMode
            ? {}
            : { error: sanitizeErrorMessage(error.message) }),
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      databaseReachable: true,
      tablesAccessible: true,
      timestamp,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Supabase health check failed";
    const isEnvError = message.includes("Missing required environment variable");

    return NextResponse.json(
      {
        ok: false,
        databaseReachable: false,
        tablesAccessible: false,
        timestamp,
        ...(productionMode ? {} : { error: sanitizeErrorMessage(message) }),
      },
      { status: isEnvError ? 503 : 500 },
    );
  }
}
