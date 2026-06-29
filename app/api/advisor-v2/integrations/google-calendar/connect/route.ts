import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { assertCrmV2GoogleCalendarAccess } from "@/lib/crm-v2/access";
import { isGoogleCalendarConfigured, getGoogleCalendarRedirectUri, getGoogleCalendarScopes, getGoogleClientId } from "@/lib/google/env";
import { createOAuthState } from "@/lib/google/oauthState";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const access = await assertCrmV2GoogleCalendarAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "Cache-Control": PRIVATE_CACHE, "X-Request-Id": access.requestId },
        },
      );
    }

    if (!isGoogleCalendarConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Google Calendar integration is not configured" },
        { status: 503, headers: { "Cache-Control": PRIVATE_CACHE, "X-Request-Id": access.requestId } },
      );
    }

    const origin = new URL(request.url).origin;
    const redirectUri = getGoogleCalendarRedirectUri(origin);
    const state = createOAuthState(access.authUser.id);
    const stateHash = createHash("sha256").update(state).digest("hex");
    const admin = createAdminSupabaseClient();
    await admin.from("crm_google_oauth_states").insert({
      state_hash: stateHash,
      adviser_user_id: access.authUser.id,
      redirect_uri: redirectUri,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    } as never);
    const params = new URLSearchParams({
      client_id: getGoogleClientId(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: getGoogleCalendarScopes().join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.json(
      { ok: true, authorizeUrl },
      { headers: { "Cache-Control": PRIVATE_CACHE, "X-Request-Id": access.requestId } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to prepare Google OAuth") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
