import "server-only";

import { NextResponse } from "next/server";

/**
 * Debug-only API routes must call this before handling.
 * Returns 404 in production so scanners and deploys treat the route as gated.
 */
export function blockDebugRouteInProduction(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return null;
}
