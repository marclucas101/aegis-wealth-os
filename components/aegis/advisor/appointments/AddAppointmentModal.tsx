"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AdviserAppointmentRow,
  AdviserCalendarSettings,
  CalendarLocationType,
} from "@/lib/aegis/calendar";
import type { MyClientsListItem } from "@/lib/aegis/myClients";

type CreateResponse =
  | { ok: true; appointment: AdviserAppointmentRow }
  | {
      ok: false;
      error?: string;
      reason?: string;
      googleConflicts?: Array<{ start: string; end: string }>;
    };

const fieldLabel =
  "text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866]/70";
const fieldInput =
  "mt-2 w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition focus:border-[#D1A866]/35";

interface AddAppointmentModalProps {
  onClose: () => void;
  onCreated: () => void;
  editing?: AdviserAppointmentRow | null;
}

export default function AddAppointmentModal({
  onClose,
  onCreated,
  editing = null,
}: AddAppointmentModalProps) {
  const [clients, setClients] = useState<MyClientsListItem[]>([]);
  const [settings, setSettings] = useState<AdviserCalendarSettings | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConflict, setGoogleConflict] = useState(false);

  const [clientId, setClientId] = useState(editing?.clientId ?? "");
  const [clientSearch, setClientSearch] = useState("");
  const [appointmentType, setAppointmentType] = useState(
    editing?.appointmentType ?? "review",
  );
  const [date, setDate] = useState(
    editing ? editing.startsAt.slice(0, 10) : "",
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [timezone, setTimezone] = useState(
    editing?.timezone ?? "Asia/Singapore",
  );
  const [locationType, setLocationType] = useState<CalendarLocationType>(
    editing?.locationType ?? "google_meet",
  );
  const [locationText, setLocationText] = useState(
    editing?.locationText ?? "",
  );
  const [phoneInstructions, setPhoneInstructions] = useState(
    editing?.phoneInstructions ?? "",
  );
  const [customMeetingLink, setCustomMeetingLink] = useState("");
  const [clientVisibleDescription, setClientVisibleDescription] = useState(
    editing?.clientNotes ?? "",
  );
  const [privateAdviserNote, setPrivateAdviserNote] = useState(
    editing?.privateAdviserNote ?? "",
  );
  const [externalReference, setExternalReference] = useState(
    editing?.externalReference ?? "",
  );
  const [externalUrl, setExternalUrl] = useState(editing?.externalUrl ?? "");
  const [source, setSource] = useState<"adviser_created" | "external_import">(
    editing?.source === "external_import" ? "external_import" : "adviser_created",
  );
  const [syncToGoogleCalendar, setSyncToGoogleCalendar] = useState(
    editing?.calendarSyncStatus === "synced",
  );
  const [sendClientNotification, setSendClientNotification] = useState(true);

  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [clientsRes, settingsRes] = await Promise.all([
          fetch("/api/advisor/clients?status=active&pageSize=100", {
            cache: "no-store",
          }),
          fetch("/api/advisor/calendar/settings", { cache: "no-store" }),
        ]);

        const clientsPayload = (await clientsRes.json()) as {
          ok: boolean;
          clients?: MyClientsListItem[];
        };
        const settingsPayload = (await settingsRes.json()) as {
          ok: boolean;
          settings?: AdviserCalendarSettings;
        };

        if (cancelled) return;

        if (clientsPayload.ok && clientsPayload.clients) {
          setClients(clientsPayload.clients);
        }

        if (settingsPayload.ok && settingsPayload.settings) {
          setSettings(settingsPayload.settings);
          if (!editing) {
            setTimezone(settingsPayload.settings.timezone);
            setLocationType(settingsPayload.settings.locationType);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load form data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [editing]);

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter(
      (client) =>
        client.displayName.toLowerCase().includes(query) ||
        (client.email?.toLowerCase().includes(query) ?? false),
    );
  }, [clients, clientSearch]);

  const submit = useCallback(
    async (options?: {
      confirmGoogleConflict?: boolean;
      forceAegisOnly?: boolean;
    }) => {
      setSaving(true);
      setError(null);

      const shouldSync = options?.forceAegisOnly
        ? false
        : syncToGoogleCalendar;

      const payload = {
        clientId,
        appointmentType,
        date,
        startTime,
        endTime,
        timezone,
        locationType,
        locationText,
        phoneInstructions,
        customMeetingLink,
        clientVisibleDescription,
        privateAdviserNote,
        externalReference,
        externalUrl,
        source,
        syncToGoogleCalendar: shouldSync,
        sendClientNotification,
        confirmGoogleConflict: options?.confirmGoogleConflict === true,
        idempotencyKey,
      };

      try {
        const response = await fetch(
          editing
            ? `/api/advisor/appointments/${editing.id}`
            : "/api/advisor/appointments",
          {
            method: editing ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              editing
                ? {
                    ...payload,
                    sendClientNotification: false,
                  }
                : payload,
            ),
          },
        );

        const result = (await response.json()) as CreateResponse;

        if (!response.ok || !result.ok) {
          if (
            !result.ok &&
            result.reason === "google_conflict" &&
            !options?.confirmGoogleConflict &&
            !options?.forceAegisOnly
          ) {
            setGoogleConflict(true);
            setError(
              result.error ??
                "Google Calendar reports a conflict. Confirm to save anyway without syncing, or adjust the time.",
            );
            return;
          }

          setError(
            result.ok ? "Save failed" : result.error ?? "Save failed",
          );
          return;
        }

        onCreated();
        onClose();
      } catch {
        setError("Save failed");
      } finally {
        setSaving(false);
      }
    },
    [
      clientId,
      appointmentType,
      date,
      startTime,
      endTime,
      timezone,
      locationType,
      locationText,
      phoneInstructions,
      customMeetingLink,
      clientVisibleDescription,
      privateAdviserNote,
      externalReference,
      externalUrl,
      source,
      syncToGoogleCalendar,
      sendClientNotification,
      idempotencyKey,
      editing,
      onCreated,
      onClose,
    ],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#071B2A]/80 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A] shadow-2xl">
        <div className="border-b border-[#D1A866]/10 px-5 py-4 sm:px-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            {editing ? "Edit appointment" : "Add appointment"}
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
            Record an appointment arranged outside AEGIS or schedule directly for
            an assigned client.
          </p>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? (
            <p className="text-sm text-[#F3F1EA]/45">Loading…</p>
          ) : (
            <div className="space-y-4">
              {!editing ? (
                <>
                  <label className="block">
                    <span className={fieldLabel}>Search client</span>
                    <input
                      value={clientSearch}
                      onChange={(event) =>
                        setClientSearch(event.target.value)
                      }
                      placeholder="Search assigned clients"
                      className={fieldInput}
                    />
                  </label>

                  <label className="block">
                    <span className={fieldLabel}>Client</span>
                    <select
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                      className={fieldInput}
                    >
                      <option value="">Select client</option>
                      {filteredClients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.displayName}
                          {client.email ? ` · ${client.email}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={fieldLabel}>Appointment type</span>
                  <select
                    value={appointmentType}
                    onChange={(event) =>
                      setAppointmentType(event.target.value)
                    }
                    className={fieldInput}
                  >
                    {(settings?.appointmentTypes ?? []).map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={fieldLabel}>Source</span>
                  <select
                    value={source}
                    onChange={(event) =>
                      setSource(
                        event.target.value as
                          | "adviser_created"
                          | "external_import",
                      )
                    }
                    className={fieldInput}
                  >
                    <option value="adviser_created">Adviser created</option>
                    <option value="external_import">External import</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={fieldLabel}>Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={fieldInput}
                  />
                </label>

                <label className="block">
                  <span className={fieldLabel}>Time zone</span>
                  <input
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    className={fieldInput}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={fieldLabel}>Start time</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className={fieldInput}
                  />
                </label>

                <label className="block">
                  <span className={fieldLabel}>End time</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className={fieldInput}
                  />
                </label>
              </div>

              <label className="block">
                <span className={fieldLabel}>Meeting location type</span>
                <select
                  value={locationType}
                  onChange={(event) =>
                    setLocationType(event.target.value as CalendarLocationType)
                  }
                  className={fieldInput}
                >
                  <option value="google_meet">Google Meet</option>
                  <option value="physical">Physical location</option>
                  <option value="phone">Phone</option>
                </select>
              </label>

              {locationType === "physical" ? (
                <label className="block">
                  <span className={fieldLabel}>Physical location</span>
                  <input
                    value={locationText}
                    onChange={(event) => setLocationText(event.target.value)}
                    className={fieldInput}
                  />
                </label>
              ) : null}

              {locationType === "phone" ? (
                <label className="block">
                  <span className={fieldLabel}>Phone instructions</span>
                  <input
                    value={phoneInstructions}
                    onChange={(event) =>
                      setPhoneInstructions(event.target.value)
                    }
                    className={fieldInput}
                  />
                </label>
              ) : null}

              {locationType === "google_meet" && !syncToGoogleCalendar ? (
                <label className="block">
                  <span className={fieldLabel}>Custom meeting link</span>
                  <input
                    value={customMeetingLink}
                    onChange={(event) =>
                      setCustomMeetingLink(event.target.value)
                    }
                    className={fieldInput}
                  />
                </label>
              ) : null}

              <label className="block">
                <span className={fieldLabel}>Client-visible description</span>
                <textarea
                  rows={3}
                  value={clientVisibleDescription}
                  onChange={(event) =>
                    setClientVisibleDescription(event.target.value)
                  }
                  className={fieldInput}
                />
              </label>

              <label className="block">
                <span className={fieldLabel}>Private adviser note</span>
                <textarea
                  rows={2}
                  value={privateAdviserNote}
                  onChange={(event) =>
                    setPrivateAdviserNote(event.target.value)
                  }
                  className={fieldInput}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={fieldLabel}>External reference</span>
                  <input
                    value={externalReference}
                    onChange={(event) =>
                      setExternalReference(event.target.value)
                    }
                    className={fieldInput}
                  />
                </label>

                <label className="block">
                  <span className={fieldLabel}>External URL</span>
                  <input
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value)}
                    className={fieldInput}
                  />
                </label>
              </div>

              <div className="space-y-2 rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/35 p-4">
                <label className="flex items-center gap-3 text-sm text-[#F3F1EA]/75">
                  <input
                    type="checkbox"
                    checked={syncToGoogleCalendar}
                    onChange={(event) =>
                      setSyncToGoogleCalendar(event.target.checked)
                    }
                  />
                  Sync to Google Calendar
                </label>
                <label className="flex items-center gap-3 text-sm text-[#F3F1EA]/75">
                  <input
                    type="checkbox"
                    checked={sendClientNotification}
                    onChange={(event) =>
                      setSendClientNotification(event.target.checked)
                    }
                  />
                  Send client email notification
                </label>
              </div>

              {error ? (
                <p className="text-xs font-light text-red-200/80">{error}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#D1A866]/10 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-[#D1A866]/20 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/60"
          >
            Cancel
          </button>
          {googleConflict ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submit({ forceAegisOnly: true })}
                className="rounded-sm border border-amber-400/30 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-amber-100/80"
              >
                Save to AEGIS only
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void submit({ confirmGoogleConflict: true })
                }
                className="rounded-sm border border-amber-400/30 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-amber-100/80"
              >
                Override Google conflict
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={saving || loading || (!editing && !clientId)}
            onClick={() => void submit()}
            className="rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[#D1A866] disabled:opacity-45"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Save appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}
