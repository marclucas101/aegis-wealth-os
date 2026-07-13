import { NextResponse } from "next/server";

import { assertCrmV2ClientAdvocacyAccess } from "@/lib/crm-v2/access";
import {
  loadClientAdvocacyPreferences,
  submitClientAdvocacyPreferences,
} from "@/lib/crm-v2/advocacy/advocacy";
import type { UpdateClientAdvocacyPreferencesInput } from "@/lib/crm-v2/advocacy/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientAdvocacyAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const preferences = await loadClientAdvocacyPreferences({ clientId: access.client.id });
    return NextResponse.json(
      { ok: true, preferences },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load advocacy preferences") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientAdvocacyAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const body = (await request.json()) as UpdateClientAdvocacyPreferencesInput;
    const result = await submitClientAdvocacyPreferences({
      authUserId: access.authUserId,
      clientId: access.client.id,
      adviserUserId: access.client.advisor_user_id ?? access.authUserId,
      payload: body,
      requestId: access.requestId,
    });

    if (!result.ok) {
      const status =
        result.reason === "conflict" ? 409 : result.reason === "forbidden" ? 403 : 400;
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        {
          status,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      { ok: true, preferences: result.data },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update advocacy preferences") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
