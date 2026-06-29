import "server-only";

import {
  decryptSecret,
  encryptSecret,
} from "@/lib/security/tokenEncryption";
import { fetchWithTimeout } from "@/lib/server/fetchWithTimeout";

import {
  getGoogleCalendarRedirectUri,
  getGoogleCalendarScopes,
  getGoogleClientId,
  getGoogleClientSecret,
} from "./env";
import { createOAuthState } from "./oauthState";

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
};

type FreeBusyResponse = {
  calendars?: Record<
    string,
    { busy?: Array<{ start: string; end: string }> }
  >;
};

type GoogleEventResponse = {
  id: string;
  htmlLink?: string;
  hangoutLink?: string;
};

async function postForm(
  url: string,
  body: Record<string, string>,
): Promise<Response> {
  return fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
}

export function buildGoogleAuthorizeUrl(
  adviserUserId: string,
  requestOrigin: string,
): string {
  const redirectUri = getGoogleCalendarRedirectUri(requestOrigin);
  const state = createOAuthState(adviserUserId);
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: getGoogleCalendarScopes().join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAuthCode(
  code: string,
  requestOrigin: string,
): Promise<GoogleTokenResponse> {
  const response = await postForm("https://oauth2.googleapis.com/token", {
    code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: getGoogleCalendarRedirectUri(requestOrigin),
    grant_type: "authorization_code",
  });

  if (!response.ok) {
    throw new Error("Google authorization failed");
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const response = await postForm("https://oauth2.googleapis.com/token", {
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  if (!response.ok) {
    throw new Error("Google token refresh failed");
  }

  return (await response.json()) as GoogleTokenResponse;
}

export function encryptGoogleToken(token: string): string {
  return encryptSecret(token);
}

export function decryptGoogleToken(ciphertext: string): string {
  return decryptSecret(ciphertext);
}

export async function listWritableCalendars(
  accessToken: string,
): Promise<GoogleCalendarListItem[]> {
  const response = await fetchWithTimeout(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to list Google calendars");
  }

  const payload = (await response.json()) as {
    items?: GoogleCalendarListItem[];
  };

  return payload.items ?? [];
}

export async function queryGoogleFreeBusy(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<Array<{ start: string; end: string }>> {
  const response = await fetchWithTimeout(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: calendarId }],
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to query Google Calendar availability");
  }

  const payload = (await response.json()) as FreeBusyResponse;
  return payload.calendars?.[calendarId]?.busy ?? [];
}

export type CreateCalendarEventInput = {
  calendarId: string;
  accessToken: string;
  summary: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  attendeeEmail: string;
  locationType: "physical" | "phone" | "google_meet";
  meetingLocationText?: string | null;
  sendUpdates?: "none" | "externalOnly" | "all";
  conferenceRequestId?: string;
};

export async function updateGoogleCalendarEvent(
  input: CreateCalendarEventInput & { eventId: string },
): Promise<GoogleEventResponse> {
  const eventBody: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? "",
    start: {
      dateTime: input.startsAt,
      timeZone: input.timezone,
    },
    end: {
      dateTime: input.endsAt,
      timeZone: input.timezone,
    },
    attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : [],
    reminders: { useDefault: true },
  };

  if (input.locationType === "physical" && input.meetingLocationText) {
    eventBody.location = input.meetingLocationText;
  } else if (input.locationType === "phone") {
    eventBody.location = "Phone consultation";
  }

  const params = new URLSearchParams({
    sendUpdates: input.sendUpdates ?? "none",
    conferenceDataVersion: input.locationType === "google_meet" ? "1" : "0",
  });

  const response = await fetchWithTimeout(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}?${params.toString()}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to update Google Calendar event");
  }

  return (await response.json()) as GoogleEventResponse;
}

export async function createGoogleCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<GoogleEventResponse> {
  const eventBody: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? "",
    start: {
      dateTime: input.startsAt,
      timeZone: input.timezone,
    },
    end: {
      dateTime: input.endsAt,
      timeZone: input.timezone,
    },
    attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : [],
    reminders: { useDefault: true },
  };

  if (input.locationType === "physical" && input.meetingLocationText) {
    eventBody.location = input.meetingLocationText;
  } else if (input.locationType === "phone") {
    eventBody.location = "Phone consultation";
  } else {
    eventBody.conferenceData = {
      createRequest: {
        requestId: input.conferenceRequestId ?? `aegis-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const params = new URLSearchParams({
    sendUpdates: input.sendUpdates ?? "none",
    conferenceDataVersion: input.locationType === "google_meet" ? "1" : "0",
  });

  const response = await fetchWithTimeout(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to create Google Calendar event");
  }

  return (await response.json()) as GoogleEventResponse;
}

export async function cancelGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  accessToken: string,
): Promise<void> {
  const params = new URLSearchParams({ sendUpdates: "all" });
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?${params.toString()}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error("Failed to cancel Google Calendar event");
  }
}

export async function revokeGoogleRefreshToken(
  refreshToken: string,
): Promise<void> {
  const response = await postForm("https://oauth2.googleapis.com/revoke", {
    token: refreshToken,
  });

  if (!response.ok && response.status !== 400) {
    throw new Error("Failed to revoke Google token");
  }
}
