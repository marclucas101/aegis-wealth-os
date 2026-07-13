import { NextResponse } from "next/server";

import { assertCrmV2ClientMessagesAccess } from "@/lib/crm-v2/access";
import {
  loadClientCommunicationPreferences,
  updateClientCommunicationPreferences,
} from "@/lib/crm-v2/communications/communications";
import type { UpdateClientCommunicationPreferencesInput } from "@/lib/crm-v2/communications/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientMessagesAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const preferences = await loadClientCommunicationPreferences({ clientId: access.client.id });

    return NextResponse.json(
      { ok: true, preferences },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
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
    const access = await assertCrmV2ClientMessagesAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const body = (await request.json()) as UpdateClientCommunicationPreferencesInput;
    const result = await updateClientCommunicationPreferences({
      clientId: access.client.id,
      authUserId: access.authUserId,
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
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update preferences") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
