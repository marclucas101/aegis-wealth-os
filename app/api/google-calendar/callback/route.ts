import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { isGoogleCalendarConfigured } from "@/lib/google/env";
import {
  exchangeGoogleAuthCode,
  listWritableCalendars,
} from "@/lib/google/calendarClient";
import { verifyOAuthState } from "@/lib/google/oauthState";
import { saveGoogleCalendarConnection } from "@/lib/supabase/calendarPersistence";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const origin = url.origin;

  const redirectBase = `${origin}/advisor-v2/settings/integrations/google-calendar`;

  if (oauthError) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Missing OAuth parameters")}`,
    );
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Google Calendar is not configured")}`,
    );
  }

  const access = await requireAdvisorAccess();
  if (!access.allowed) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Authentication is required to complete Google connection")}`,
    );
  }

  const payload = verifyOAuthState(state);
  if (!payload) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Invalid OAuth state")}`,
    );
  }
  if (payload.adviserUserId !== access.authUser.id) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("OAuth state does not match signed-in adviser")}`,
    );
  }

  const admin = createAdminSupabaseClient();
  const stateHash = createHash("sha256").update(state).digest("hex");
  const { data: stateRow, error: stateError } = await admin
    .from("crm_google_oauth_states")
    .select("state_hash, adviser_user_id, expires_at, consumed_at")
    .eq("state_hash", stateHash)
    .eq("adviser_user_id", access.authUser.id)
    .maybeSingle();
  if (
    stateError ||
    !stateRow ||
    (stateRow as { consumed_at: string | null }).consumed_at ||
    Date.parse((stateRow as { expires_at: string }).expires_at) < Date.now()
  ) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("OAuth state replay or expiration detected")}`,
    );
  }

  try {
    const tokens = await exchangeGoogleAuthCode(code, origin);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        `${redirectBase}?error=${encodeURIComponent("Google did not return a refresh token. Disconnect and reconnect with consent.")}`,
      );
    }

    const calendars = await listWritableCalendars(tokens.access_token);
    const primary = calendars.find((item) => item.primary) ?? calendars[0];

    await saveGoogleCalendarConnection({
      adviserUserId: access.authUser.id,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      scopes: tokens.scope.split(" "),
      calendarId: primary?.id ?? "primary",
      calendarEmail: primary?.summary ?? null,
    });
    await admin
      .from("crm_google_oauth_states")
      .update({ consumed_at: new Date().toISOString() } as never)
      .eq("state_hash", stateHash);

    return NextResponse.redirect(`${redirectBase}?connected=1`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google Calendar connection failed";
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(message)}`,
    );
  }
}
