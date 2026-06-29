import "server-only";

import {
  cancelGoogleCalendarEvent,
  createGoogleCalendarEvent,
  listWritableCalendars,
  updateGoogleCalendarEvent,
} from "@/lib/google/calendarClient";

export type GoogleCalendarWritable = {
  id: string;
  summary: string;
  primary: boolean;
};

export type GoogleProviderEventInput = {
  calendarId: string;
  accessToken: string;
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  attendeeEmail?: string | null;
  locationType: "physical" | "phone" | "google_meet";
  meetingLocationText?: string | null;
  conferenceRequestId?: string | null;
  sendUpdates: "none" | "externalOnly" | "all";
  eventId?: string;
};

function mapSendUpdates(value: "none" | "externalOnly" | "all"): "none" | "externalOnly" | "all" {
  return value;
}

export async function providerListWritableCalendars(
  accessToken: string,
): Promise<GoogleCalendarWritable[]> {
  const items = await listWritableCalendars(accessToken);
  return items.map((item) => ({
    id: item.id,
    summary: item.summary,
    primary: Boolean(item.primary),
  }));
}

export async function providerCreateEvent(input: GoogleProviderEventInput): Promise<{
  eventId: string;
  htmlLink: string | null;
  hangoutLink: string | null;
}> {
  const event = await createGoogleCalendarEvent({
    calendarId: input.calendarId,
    accessToken: input.accessToken,
    summary: input.summary,
    description: input.description,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone,
    attendeeEmail: input.attendeeEmail ?? "",
    locationType: input.locationType,
    meetingLocationText: input.meetingLocationText,
    sendUpdates: mapSendUpdates(input.sendUpdates),
    conferenceRequestId: input.conferenceRequestId ?? undefined,
  });
  return {
    eventId: event.id,
    htmlLink: event.htmlLink ?? null,
    hangoutLink: event.hangoutLink ?? null,
  };
}

export async function providerUpdateEvent(input: GoogleProviderEventInput & { eventId: string }): Promise<{
  eventId: string;
  htmlLink: string | null;
  hangoutLink: string | null;
}> {
  const event = await updateGoogleCalendarEvent({
    calendarId: input.calendarId,
    accessToken: input.accessToken,
    eventId: input.eventId,
    summary: input.summary,
    description: input.description,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone,
    attendeeEmail: input.attendeeEmail ?? "",
    locationType: input.locationType,
    meetingLocationText: input.meetingLocationText,
    sendUpdates: mapSendUpdates(input.sendUpdates),
    conferenceRequestId: input.conferenceRequestId ?? undefined,
  });
  return {
    eventId: event.id,
    htmlLink: event.htmlLink ?? null,
    hangoutLink: event.hangoutLink ?? null,
  };
}

export async function providerCancelEvent(input: {
  calendarId: string;
  eventId: string;
  accessToken: string;
}): Promise<void> {
  await cancelGoogleCalendarEvent(input.calendarId, input.eventId, input.accessToken);
}
