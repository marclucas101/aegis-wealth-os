"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { AdviserCalendarSettings } from "@/lib/aegis/calendar";
import { DAY_KEYS } from "@/lib/aegis/calendar";

type StatusResponse =
  | {
      ok: true;
      connection: {
        connected: boolean;
        calendarId: string | null;
        calendarEmail: string | null;
        connectedAt: string | null;
        revoked: boolean;
      };
      settings: AdviserCalendarSettings;
      calendars: Array<{ id: string; summary: string; primary: boolean }>;
    }
  | { ok: false; error?: string; reason?: string };

const LOCATION_OPTIONS = [
  { value: "google_meet", label: "Google Meet" },
  { value: "phone", label: "Phone" },
  { value: "physical", label: "Physical location" },
] as const;

export default function CalendarSetupClient() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [settings, setSettings] = useState<AdviserCalendarSettings | null>(null);
  const [blackoutInput, setBlackoutInput] = useState("");

  const oauthConnected = searchParams.get("connected") === "1";
  const oauthErrorParam = searchParams.get("error");
  const oauthSuccessMessage = oauthConnected
    ? "Google Calendar connected successfully."
    : null;
  const oauthErrorMessage = oauthErrorParam ?? null;

  const loadStatus = useCallback(async (options?: { showLoading?: boolean }) => {
    if (options?.showLoading !== false) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/advisor/calendar/status", {
        cache: "no-store",
      });
      const payload = (await response.json()) as StatusResponse;

      if (!response.ok || !payload.ok) {
        setError(
          payload.ok ? "Failed to load calendar status" : payload.error ?? "Failed to load calendar status",
        );
        setStatus(null);
        return;
      }

      setStatus(payload);
      setSettings(payload.settings);
    } catch {
      setError("Failed to load calendar status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/advisor/calendar/status", {
          cache: "no-store",
        });
        const payload = (await response.json()) as StatusResponse;

        if (cancelled) return;

        if (!response.ok || !payload.ok) {
          setError(
            payload.ok
              ? "Failed to load calendar status"
              : payload.error ?? "Failed to load calendar status",
          );
          setStatus(null);
          return;
        }

        setStatus(payload);
        setSettings(payload.settings);
      } catch {
        if (!cancelled) {
          setError("Failed to load calendar status");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDisconnect() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/advisor/calendar/disconnect", {
        method: "POST",
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Failed to disconnect calendar");
        return;
      }

      setSuccess("Google Calendar disconnected.");
      await loadStatus({ showLoading: false });
    } catch {
      setError("Failed to disconnect calendar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/advisor/calendar/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = (await response.json()) as
        | { ok: true; settings: AdviserCalendarSettings }
        | { ok: false; error?: string };

      if (!response.ok || !payload.ok) {
        setError(payload.ok ? "Failed to save settings" : payload.error ?? "Failed to save settings");
        return;
      }

      setSettings(payload.settings);
      setSuccess("Calendar settings saved.");
      await loadStatus({ showLoading: false });
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateSettings(patch: Partial<AdviserCalendarSettings>) {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  }

  function addBlackoutDate() {
    if (!settings || !blackoutInput) return;
    if (settings.blackoutDates.includes(blackoutInput)) return;
    updateSettings({
      blackoutDates: [...settings.blackoutDates, blackoutInput].sort(),
    });
    setBlackoutInput("");
  }

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  if (!settings || !status?.ok) {
    return (
      <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 p-8 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/55">
          {error ?? "Unable to load calendar setup"}
        </p>
      </div>
    );
  }

  const connection = status.connection;

  return (
    <div className="space-y-8">
      {error && !oauthErrorMessage && (
        <div className="rounded-sm border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      )}
      {oauthErrorMessage && (
        <div className="rounded-sm border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm text-red-200/80">
          {oauthErrorMessage}
        </div>
      )}
      {(success || oauthSuccessMessage) && (
        <div className="rounded-sm border border-[#D1A866]/25 bg-[#10283A]/60 px-4 py-3 text-sm text-[#D1A866]/90">
          {success ?? oauthSuccessMessage}
        </div>
      )}

      <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Google Calendar
        </p>
        <h2 className="mt-2 text-xl font-light text-[#F3F1EA]">
          {connection.connected ? "Connected" : "Not connected"}
        </h2>
        {connection.connected && connection.calendarEmail && (
          <p className="mt-2 text-sm font-light text-[#F3F1EA]/50">
            Calendar: {connection.calendarEmail}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {!connection.connected ? (
            <a
              href="/api/advisor/calendar/connect"
              className="inline-flex items-center rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-4 py-2 text-sm text-[#F3F1EA] hover:bg-[#D1A866]/20"
            >
              Connect Google Calendar
            </a>
          ) : (
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={saving}
              className="rounded-sm border border-[#F3F1EA]/15 px-4 py-2 text-sm text-[#F3F1EA]/70 hover:bg-[#071B2A]/50 disabled:opacity-50"
            >
              Disconnect
            </button>
          )}
        </div>
      </section>

      {connection.connected && (
        <>
          <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-6 space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                Writable calendar
              </label>
              <select
                value={
                  status.calendars.find((c) => c.id === connection.calendarId)?.id ??
                  connection.calendarId ??
                  ""
                }
                onChange={(event) => {
                  const selected = status.calendars.find(
                    (item) => item.id === event.target.value,
                  );
                  updateSettings({
                    ...settings,
                  });
                  void fetch("/api/advisor/calendar/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      calendarId: event.target.value,
                      calendarEmail: selected?.summary ?? null,
                    }),
                  }).then(() => loadStatus({ showLoading: false }));
                }}
                className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
              >
                {status.calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.summary}
                    {calendar.primary ? " (primary)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                  Time zone
                </label>
                <input
                  value={settings.timezone}
                  onChange={(e) => updateSettings({ timezone: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                  Default duration (minutes)
                </label>
                <input
                  type="number"
                  min={15}
                  max={480}
                  value={settings.appointmentDurationMinutes}
                  onChange={(e) =>
                    updateSettings({
                      appointmentDurationMinutes: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                  Buffer before (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  value={settings.bufferBeforeMinutes}
                  onChange={(e) =>
                    updateSettings({ bufferBeforeMinutes: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                  Buffer after (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  value={settings.bufferAfterMinutes}
                  onChange={(e) =>
                    updateSettings({ bufferAfterMinutes: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                  Minimum notice (hours)
                </label>
                <input
                  type="number"
                  min={0}
                  value={settings.minimumNoticeHours}
                  onChange={(e) =>
                    updateSettings({ minimumNoticeHours: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                  Booking horizon (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={settings.bookingHorizonDays}
                  onChange={(e) =>
                    updateSettings({ bookingHorizonDays: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                Meeting location
              </label>
              <select
                value={settings.locationType}
                onChange={(e) =>
                  updateSettings({
                    locationType: e.target.value as AdviserCalendarSettings["locationType"],
                  })
                }
                className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
              >
                {LOCATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {settings.locationType === "physical" && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                  Physical location
                </label>
                <input
                  value={settings.meetingLocationText ?? ""}
                  onChange={(e) =>
                    updateSettings({ meetingLocationText: e.target.value })
                  }
                  className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
                />
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                Working hours
              </p>
              <div className="mt-2 space-y-2">
                {DAY_KEYS.map((day) => {
                  const config = settings.workingHours[day];
                  return (
                    <div
                      key={day}
                      className="grid grid-cols-[100px_1fr_1fr_1fr] items-center gap-2 text-sm"
                    >
                      <label className="capitalize text-[#F3F1EA]/60">{day}</label>
                      <input
                        type="checkbox"
                        checked={config?.enabled ?? false}
                        onChange={(e) =>
                          updateSettings({
                            workingHours: {
                              ...settings.workingHours,
                              [day]: {
                                ...config,
                                enabled: e.target.checked,
                                start: config?.start ?? "09:00",
                                end: config?.end ?? "17:00",
                              },
                            },
                          })
                        }
                      />
                      <input
                        value={config?.start ?? "09:00"}
                        disabled={!config?.enabled}
                        onChange={(e) =>
                          updateSettings({
                            workingHours: {
                              ...settings.workingHours,
                              [day]: { ...config, start: e.target.value },
                            },
                          })
                        }
                        className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-2 py-1 text-[#F3F1EA] disabled:opacity-40"
                      />
                      <input
                        value={config?.end ?? "17:00"}
                        disabled={!config?.enabled}
                        onChange={(e) =>
                          updateSettings({
                            workingHours: {
                              ...settings.workingHours,
                              [day]: { ...config, end: e.target.value },
                            },
                          })
                        }
                        className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-2 py-1 text-[#F3F1EA] disabled:opacity-40"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                Blackout dates
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {settings.blackoutDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() =>
                      updateSettings({
                        blackoutDates: settings.blackoutDates.filter(
                          (item) => item !== date,
                        ),
                      })
                    }
                    className="rounded-sm border border-[#D1A866]/20 px-2 py-1 text-xs text-[#F3F1EA]/70"
                  >
                    {date} ×
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="date"
                  value={blackoutInput}
                  onChange={(e) => setBlackoutInput(e.target.value)}
                  className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
                />
                <button
                  type="button"
                  onClick={addBlackoutDate}
                  className="rounded-sm border border-[#D1A866]/30 px-3 py-2 text-sm text-[#D1A866]"
                >
                  Add
                </button>
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm text-[#F3F1EA]/70">
              <input
                type="checkbox"
                checked={settings.bookingEnabled}
                onChange={(e) =>
                  updateSettings({ bookingEnabled: e.target.checked })
                }
              />
              Enable client booking on My Adviser
            </label>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-5 py-2 text-sm text-[#F3F1EA] hover:bg-[#D1A866]/20 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save calendar settings"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
