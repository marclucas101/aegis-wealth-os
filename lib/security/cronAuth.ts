import "server-only";

import { NextResponse } from "next/server";

/**
 * Validates Vercel Cron / internal scheduler requests.
 * Expects Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 */
export function validateCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${secret}`) {
    return true;
  }

  return request.headers.get("x-cron-secret") === secret;
}

export function cronUnauthorizedResponse(): NextResponse<{ ok: false; error: string }> {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
