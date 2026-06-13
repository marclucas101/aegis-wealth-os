import { NextResponse } from "next/server";

import { isGoogleCalendarConfigured } from "@/lib/google/env";
import {
  exchangeGoogleAuthCode,
  listWritableCalendars,
} from "@/lib/google/calendarClient";
import { verifyOAuthState } from "@/lib/google/oauthState";
import { saveGoogleCalendarConnection } from "@/lib/supabase/calendarPersistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const origin = url.origin;

  const redirectBase = `${origin}/advisor/calendar`;

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

  const payload = verifyOAuthState(state);
  if (!payload) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Invalid OAuth state")}`,
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
      adviserUserId: payload.adviserUserId,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      scopes: tokens.scope.split(" "),
      calendarId: primary?.id ?? "primary",
      calendarEmail: primary?.summary ?? null,
    });

    return NextResponse.redirect(`${redirectBase}?connected=1`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google Calendar connection failed";
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(message)}`,
    );
  }
}
