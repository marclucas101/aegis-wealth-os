"use client";

import { useEffect, useState } from "react";

import AddAppointmentModal from "@/components/aegis/advisor/appointments/AddAppointmentModal";
import type { AdviserAppointmentRow } from "@/lib/aegis/calendar";

type AppointmentsResponse =
  | { ok: true; appointments: AdviserAppointmentRow[] }
  | { ok: false; error?: string; reason?: string };

function formatDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(iso));
}

function sourceLabel(source: AdviserAppointmentRow["source"]): string {
  switch (source) {
    case "adviser_created":
      return "Adviser created";
    case "external_import":
      return "External import";
    default:
      return "Client booking";
  }
}

function syncLabel(status: AdviserAppointmentRow["calendarSyncStatus"]): string {
  switch (status) {
    case "synced":
      return "Synced";
    case "failed":
      return "Sync failed";
    case "skipped":
      return "AEGIS only";
    case "not_synced":
      return "Not synced";
    default:
      return "—";
  }
}

function notificationLabel(
  status: AdviserAppointmentRow["notificationStatus"],
): string {
  switch (status) {
    case "sent":
      return "Email sent";
    case "failed":
      return "Email failed";
    case "pending":
      return "Email pending";
    case "retrying":
      return "Retrying email";
    default:
      return "No email";
  }
}

export default function AppointmentsManagerClient() {
  const [appointments, setAppointments] = useState<AdviserAppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdviserAppointmentRow | null>(null);

  async function loadAppointments(options?: { showLoading?: boolean }) {
    if (options?.showLoading !== false) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/advisor/appointments", {
        cache: "no-store",
      });
      const payload = (await response.json()) as AppointmentsResponse;

      if (!response.ok || !payload.ok) {
        setError(
          payload.ok ? "Failed to load appointments" : payload.error ?? "Failed to load appointments",
        );
        return;
      }

      setAppointments(payload.appointments);
    } catch {
      setError("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/advisor/appointments", {
          cache: "no-store",
        });
        const payload = (await response.json()) as AppointmentsResponse;

        if (cancelled) return;

        if (!response.ok || !payload.ok) {
          setError(
            payload.ok
              ? "Failed to load appointments"
              : payload.error ?? "Failed to load appointments",
          );
          return;
        }

        setAppointments(payload.appointments);
      } catch {
        if (!cancelled) {
          setError("Failed to load appointments");
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

  async function handleCancel(appointmentId: string) {
    setCancellingId(appointmentId);
    setError(null);

    try {
      const response = await fetch(
        `/api/advisor/appointments/${appointmentId}/cancel`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Failed to cancel appointment");
        return;
      }

      await loadAppointments({ showLoading: false });
    } catch {
      setError("Failed to cancel appointment");
    } finally {
      setCancellingId(null);
    }
  }

  async function handleRetryNotification(appointmentId: string) {
    setRetryingId(appointmentId);
    setError(null);

    try {
      const response = await fetch(
        `/api/advisor/appointments/${appointmentId}/retry-notification`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Failed to retry notification");
        return;
      }

      await loadAppointments({ showLoading: false });
    } catch {
      setError("Failed to retry notification");
    } finally {
      setRetryingId(null);
    }
  }

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Manage client bookings and adviser-scheduled appointments.
        </p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[#D1A866]"
        >
          Add Appointment
        </button>
      </div>

      {error && (
        <div className="rounded-sm border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      )}

      {appointments.length === 0 ? (
        <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 p-8 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/55">
            No upcoming appointments in the current window.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => (
            <article
              key={appointment.id}
              className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-sm border border-[#D1A866]/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#D1A866]/75">
                      {appointment.status}
                    </span>
                    <span className="rounded-sm border border-[#F3F1EA]/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/45">
                      {sourceLabel(appointment.source)}
                    </span>
                    <span className="rounded-sm border border-[#F3F1EA]/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/45">
                      {syncLabel(appointment.calendarSyncStatus)}
                    </span>
                    <span className="rounded-sm border border-[#F3F1EA]/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/45">
                      {notificationLabel(appointment.notificationStatus)}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-light text-[#F3F1EA]">
                    {appointment.clientName ?? "Client"} — {appointment.appointmentLabel}
                  </h3>
                  <p className="mt-1 text-sm text-[#F3F1EA]/55">
                    {formatDateTime(appointment.startsAt, appointment.timezone)}
                  </p>
                  {appointment.clientEmail ? (
                    <p className="mt-1 text-sm text-[#F3F1EA]/40">
                      {appointment.clientEmail}
                    </p>
                  ) : null}
                  {appointment.clientNotes ? (
                    <p className="mt-2 text-sm text-[#F3F1EA]/55">
                      {appointment.clientNotes}
                    </p>
                  ) : null}
                  {appointment.privateAdviserNote ? (
                    <p className="mt-2 text-xs text-[#F3F1EA]/35">
                      Private note: {appointment.privateAdviserNote}
                    </p>
                  ) : null}
                  {appointment.notificationError ? (
                    <p className="mt-2 text-xs text-red-200/70">
                      Notification: {appointment.notificationError}
                    </p>
                  ) : null}
                  {appointment.calendarSyncError ? (
                    <p className="mt-1 text-xs text-amber-100/70">
                      Google: {appointment.calendarSyncError}
                    </p>
                  ) : null}
                  {appointment.meetingUrl ? (
                    <a
                      href={appointment.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-[#D1A866] hover:underline"
                    >
                      Join meeting
                    </a>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {appointment.googleEventUrl ? (
                    <a
                      href={appointment.googleEventUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm border border-[#D1A866]/25 px-3 py-1.5 text-xs text-[#D1A866]"
                    >
                      Open in Google Calendar
                    </a>
                  ) : null}
                  {appointment.status === "confirmed" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(appointment)}
                        className="rounded-sm border border-[#F3F1EA]/15 px-3 py-1.5 text-xs text-[#F3F1EA]/60 hover:bg-[#071B2A]/50"
                      >
                        Edit
                      </button>
                      {appointment.notificationStatus === "failed" ? (
                        <button
                          type="button"
                          disabled={retryingId === appointment.id}
                          onClick={() =>
                            void handleRetryNotification(appointment.id)
                          }
                          className="rounded-sm border border-amber-400/25 px-3 py-1.5 text-xs text-amber-100/75 disabled:opacity-50"
                        >
                          Retry email
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={cancellingId === appointment.id}
                        onClick={() => void handleCancel(appointment.id)}
                        className="rounded-sm border border-[#F3F1EA]/15 px-3 py-1.5 text-xs text-[#F3F1EA]/60 hover:bg-[#071B2A]/50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreate ? (
        <AddAppointmentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => void loadAppointments({ showLoading: false })}
        />
      ) : null}

      {editing ? (
        <AddAppointmentModal
          editing={editing}
          onClose={() => setEditing(null)}
          onCreated={() => {
            setEditing(null);
            void loadAppointments({ showLoading: false });
          }}
        />
      ) : null}
    </div>
  );
}
