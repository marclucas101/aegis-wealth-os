import { NextResponse } from "next/server";

import { assertCrmV2ClientProfileAccess } from "@/lib/crm-v2/access";
import {
  loadClientRelationshipPreferences,
  submitClientPreferenceUpdate,
} from "@/lib/crm-v2/moments/moments";
import type { ClientPreferenceUpdateInput } from "@/lib/crm-v2/moments/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientProfileAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const preferences = await loadClientRelationshipPreferences({
      clientId: access.client.id,
    });

    return NextResponse.json(
      { ok: true, preferences },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load preferences") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientProfileAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const body = (await request.json()) as ClientPreferenceUpdateInput;
    const result = await submitClientPreferenceUpdate({
      clientId: access.client.id,
      authUserId: access.authUserId,
      adviserUserId: access.client.advisor_user_id ?? access.authUserId,
      payload: body,
      requestId: access.requestId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        {
          status: result.reason === "conflict" ? 409 : 400,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      { ok: true, updateId: result.data.updateId },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update preferences") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
