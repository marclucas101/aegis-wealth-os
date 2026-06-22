import "server-only";

import { timingSafeEqual } from "node:crypto";

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
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length);
    return secretsMatch(token, secret);
  }

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret) {
    return secretsMatch(headerSecret, secret);
  }

  return false;
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

export function cronUnauthorizedResponse(): NextResponse<{ ok: false; error: string }> {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
