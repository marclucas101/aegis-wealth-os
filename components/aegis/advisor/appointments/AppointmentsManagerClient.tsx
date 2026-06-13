"use client";

import { useEffect, useState } from "react";

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

export default function AppointmentsManagerClient() {
  const [appointments, setAppointments] = useState<AdviserAppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  return (
    <div className="space-y-6">
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
                  <p className="text-[10px] uppercase tracking-wider text-[#D1A866]/60">
                    {appointment.status}
                  </p>
                  <h3 className="mt-1 text-lg font-light text-[#F3F1EA]">
                    {appointment.clientName ?? "Client"} — {appointment.appointmentLabel}
                  </h3>
                  <p className="mt-1 text-sm text-[#F3F1EA]/55">
                    {formatDateTime(appointment.startsAt, appointment.timezone)}
                  </p>
                  {appointment.clientEmail && (
                    <p className="mt-1 text-sm text-[#F3F1EA]/40">
                      {appointment.clientEmail}
                    </p>
                  )}
                  {appointment.meetingUrl && (
                    <a
                      href={appointment.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-[#D1A866] hover:underline"
                    >
                      Join meeting
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {appointment.googleEventUrl && (
                    <a
                      href={appointment.googleEventUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm border border-[#D1A866]/25 px-3 py-1.5 text-xs text-[#D1A866]"
                    >
                      Open in Google Calendar
                    </a>
                  )}
                  {appointment.status === "confirmed" && (
                    <button
                      type="button"
                      disabled={cancellingId === appointment.id}
                      onClick={() => void handleCancel(appointment.id)}
                      className="rounded-sm border border-[#F3F1EA]/15 px-3 py-1.5 text-xs text-[#F3F1EA]/60 hover:bg-[#071B2A]/50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
