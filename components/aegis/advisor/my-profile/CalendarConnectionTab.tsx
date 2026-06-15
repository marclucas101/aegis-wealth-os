"use client";

import type { CalendarStateDescriptor } from "./myProfileShared";
import {
  InlineMessage,
  SectionCard,
  StatusBanner,
  fieldLabelClass,
} from "./myProfileUi";

type CalendarConnection = {
  connected: boolean;
  calendarId: string | null;
  calendarEmail: string | null;
  connectedAt: string | null;
  revoked: boolean;
};

export default function CalendarConnectionTab({
  loading,
  loadError,
  connection,
  calendars,
  descriptor,
  actionPending,
  actionError,
  oauthConnected,
  oauthError,
  onDisconnect,
  onSelectCalendar,
}: {
  loading: boolean;
  loadError: string | null;
  connection: CalendarConnection | null;
  calendars: Array<{ id: string; summary: string; primary: boolean }>;
  descriptor: CalendarStateDescriptor;
  actionPending: boolean;
  actionError: string | null;
  oauthConnected: boolean;
  oauthError: string | null;
  onDisconnect: () => void;
  onSelectCalendar: (calendarId: string) => void;
}) {
  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  if (loadError || !connection) {
    return (
      <InlineMessage tone="error">
        {loadError ?? "Unable to load calendar status"}
      </InlineMessage>
    );
  }

  return (
    <div className="space-y-6">
      {oauthConnected && (
        <InlineMessage tone="success">
          Google Calendar connected successfully.
        </InlineMessage>
      )}
      {oauthError && <InlineMessage tone="error">{oauthError}</InlineMessage>}
      {actionError && <InlineMessage tone="error">{actionError}</InlineMessage>}

      <StatusBanner descriptor={descriptor} />

      <SectionCard
        eyebrow="Google Calendar"
        title={connection.connected ? "Connected" : "Not connected"}
      >
        {connection.connected && connection.calendarEmail && (
          <p className="-mt-2 text-sm font-light text-[#F3F1EA]/50">
            Connected account: {connection.calendarEmail}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {!connection.connected || connection.revoked ? (
            <a
              href="/api/advisor/calendar/connect"
              className="inline-flex items-center rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-4 py-2 text-sm text-[#F3F1EA] transition-colors hover:bg-[#D1A866]/20"
            >
              {connection.revoked
                ? "Reconnect Google Calendar"
                : "Connect Google Calendar"}
            </a>
          ) : (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={actionPending}
              className="rounded-sm border border-[#F3F1EA]/15 px-4 py-2 text-sm text-[#F3F1EA]/70 transition-colors hover:bg-[#071B2A]/50 disabled:opacity-50"
            >
              {actionPending ? "Working…" : "Disconnect Google Calendar"}
            </button>
          )}
        </div>
      </SectionCard>

      {connection.connected && !connection.revoked && (
        <SectionCard eyebrow="Writable calendar">
          <label className="block">
            <span className={fieldLabelClass}>
              Calendar used for client appointments
            </span>
            <select
              value={connection.calendarId ?? ""}
              disabled={actionPending || calendars.length === 0}
              onChange={(event) => onSelectCalendar(event.target.value)}
              className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA] disabled:opacity-50"
            >
              {calendars.length === 0 && (
                <option value={connection.calendarId ?? ""}>
                  {connection.calendarEmail ?? "Primary calendar"}
                </option>
              )}
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.summary}
                  {calendar.primary ? " (primary)" : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs font-light text-[#F3F1EA]/40">
            Appointments are written to this calendar and checked for conflicts.
          </p>
        </SectionCard>
      )}
    </div>
  );
}
